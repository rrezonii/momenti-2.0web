import { removeAppearedFirstFooter } from "@/lib/feed-content";

const SOURCE_FEED = "https://sinjali.com/feed/";
const SITE_ORIGIN = "https://sinjali.com";
const FEED_CACHE_MS = 60_000;
const IMAGE_CACHE_MS = 24 * 60 * 60_000;
const EMPTY_IMAGE_CACHE_MS = 60_000;
// Sinjali sometimes publishes a post before its photo is attached. A fresh post without
// a photo is held out of the feed (so WPeMatico doesn't import it photo-less) until the
// photo appears, or for at most this long, after which it is published without one.
const HOLD_WITHOUT_IMAGE_MS = 45 * 60_000;
const PUBLIC_ORIGIN = "https://momenti.info";
const UPLOADS_PREFIX = "/wp-content/uploads/";
// Formats WordPress/WPeMatico import reliably; anything else (AVIF…) is served as JPEG via /feed/image.
const IMPORTABLE_IMAGE = /\.(jpe?g|png|webp|gif)$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedImage = { value: string; expiresAt: number };

let feedCache: { value: string; expiresAt: number } | null = null;
let pendingFeed: Promise<string> | null = null;
const imageCache = new Map<string, CachedImage>();

function decodeXml(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
      (entity, code: string) => {
        if (code[0] === "#") {
          const isHex = code[1]?.toLowerCase() === "x";
          const number = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
          return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
        }

        const entities: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
        };
        return entities[code.toLowerCase()] ?? entity;
      }
    );

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function getTag(item: string, name: string) {
  const safeName = name.replace(":", "\\:");
  const match = new RegExp(`<${safeName}\\b[^>]*>([\\s\\S]*?)</${safeName}\\s*>`, "i").exec(item);
  if (!match) return "";

  const value = match[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(value);
  return decodeXml(cdata ? cdata[1].trim() : value);
}

function getAttribute(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  return match?.[2] ?? "";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapCdata(value: string) {
  return `<![CDATA[${value.replaceAll("]]>", "]]><![CDATA[>")}]]>`;
}

function normalizeArticleUrl(value: string, base = SITE_ORIGIN) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.hostname !== "sinjali.com" && url.hostname !== "www.sinjali.com") return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(value: string, articleUrl: string) {
  try {
    const url = new URL(value, articleUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.hostname !== "sinjali.com" && url.hostname !== "www.sinjali.com") return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

function extractOpenGraphImage(html: string, articleUrl: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = getAttribute(tag, "property").toLowerCase();
    const name = getAttribute(tag, "name").toLowerCase();
    if (
      property === "og:image" ||
      property === "og:image:url" ||
      property === "og:image:secure_url" ||
      name === "twitter:image" ||
      name === "twitter:image:src"
    ) {
      const image = normalizeImageUrl(getAttribute(tag, "content"), articleUrl);
      if (image) return image;
    }
  }

  return "";
}

// Sinjali's SEO plugin omits og:image for AVIF photos, so fall back to the
// schema.org thumbnail and then to the article's lazy-loaded preview image.
function extractFallbackImage(html: string, articleUrl: string) {
  const thumbnail = /"thumbnailUrl"\s*:\s*"([^"]+)"/i.exec(html)?.[1];
  if (thumbnail) {
    const image = normalizeImageUrl(thumbnail.replaceAll("\\/", "/"), articleUrl);
    if (image) return image;
  }

  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!/\bclass\s*=\s*["'][^"']*\bpreview\b/i.test(tag) && !/\bwp-post-image\b/i.test(tag)) continue;
    const source = getAttribute(tag, "data-lazy-src") || getAttribute(tag, "data-src") || getAttribute(tag, "src");
    if (!source.includes(UPLOADS_PREFIX)) continue;
    const image = normalizeImageUrl(decodeXml(source), articleUrl);
    if (image) return image;
  }

  return "";
}

function toImportableImage(image: string) {
  if (!image) return "";
  const url = new URL(image);
  if (IMPORTABLE_IMAGE.test(url.pathname)) return image;
  const index = url.pathname.indexOf(UPLOADS_PREFIX);
  if (index < 0) return "";
  const relative = url.pathname.slice(index + UPLOADS_PREFIX.length);
  if (!relative.split("/").every((part) => /^[\w.\-%]+$/.test(part))) return "";
  return `${PUBLIC_ORIGIN}/feed/image/sinjali/${relative}.jpg`;
}

async function getFeaturedImage(articleUrl: string) {
  const now = Date.now();
  const cached = imageCache.get(articleUrl);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; MomentiRSS/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return "";
    const finalUrl = normalizeArticleUrl(response.url);
    if (!finalUrl) return "";

    const html = await response.text();
    const image = toImportableImage(extractOpenGraphImage(html, finalUrl) || extractFallbackImage(html, finalUrl));
    imageCache.set(articleUrl, {
      value: image,
      expiresAt: now + (image ? IMAGE_CACHE_MS : EMPTY_IMAGE_CACHE_MS),
    });

    if (imageCache.size > 500) {
      for (const [key, value] of imageCache) {
        if (value.expiresAt <= now || imageCache.size > 400) imageCache.delete(key);
        if (imageCache.size <= 400) break;
      }
    }

    return image;
  } catch {
    return "";
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await map(items[index]);
      }
    })
  );

  return results;
}

function formatPubDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toUTCString() : parsed.toUTCString();
}

function getImageMimeType(imageUrl: string) {
  const path = new URL(imageUrl).pathname.toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function renderItem(item: string, image: string) {
  const title = getTag(item, "title");
  const link = normalizeArticleUrl(getTag(item, "link"));
  if (!title || !link) return "";

  const body = removeAppearedFirstFooter((getTag(item, "content:encoded") || getTag(item, "description"))
    .replace(/<(script|style|iframe|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .trim());

  const imageMarkup = image
    ? `<p><img src="${escapeXml(image)}" alt="${escapeXml(title)}" /></p>`
    : "";
  const content = `${imageMarkup}${body}<p>Burimi: <a href="${escapeXml(link)}">Sinjali</a></p>`;
  const imageFields = image
    ? `<enclosure url="${escapeXml(image)}" type="${getImageMimeType(image)}" />
      <media:content url="${escapeXml(image)}" medium="image" />`
    : "";
  const guid = getTag(item, "guid") || link;
  const pubDate = formatPubDate(getTag(item, "pubDate"));

  return `<item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${wrapCdata(content)}</description>
      <content:encoded>${wrapCdata(content)}</content:encoded>
      <source url="${SOURCE_FEED}">Sinjali</source>
      ${imageFields}
    </item>`;
}

async function createFeed() {
  const response = await fetch(SOURCE_FEED, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Sinjali feed returned HTTP ${response.status}`);

  const xml = await response.text();
  const sourceItems = [...xml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item\s*>/gi)].map((match) => match[0]);
  const rendered = await mapWithConcurrency(sourceItems, 3, async (item) => {
    const link = normalizeArticleUrl(getTag(item, "link"));
    const image = link ? await getFeaturedImage(link) : "";
    const published = new Date(getTag(item, "pubDate")).getTime();
    if (!image && Number.isFinite(published) && Date.now() - published < HOLD_WITHOUT_IMAGE_MS) return "";
    return renderItem(item, image);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Sinjali — Momenti Feed</title>
    <link>${SITE_ORIGIN}</link>
    <description>Lajmet e Sinjalit me imazhe kryesore për WPeMatico.</description>
    <language>sq</language>
    <ttl>5</ttl>
    ${rendered.filter(Boolean).join("\n")}
  </channel>
</rss>`;
}

async function getCachedFeed() {
  if (feedCache && feedCache.expiresAt > Date.now()) return feedCache.value;
  if (pendingFeed) return pendingFeed;

  pendingFeed = createFeed();
  try {
    const value = await pendingFeed;
    feedCache = { value, expiresAt: Date.now() + FEED_CACHE_MS };
    return value;
  } finally {
    pendingFeed = null;
  }
}

export async function GET() {
  try {
    const feed = await getCachedFeed();
    return new Response(feed, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Sinjali feed adapter error:", error);
    return new Response("Sinjali feed is temporarily unavailable", { status: 502 });
  }
}

