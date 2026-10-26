import { removeAppearedFirstFooter } from "@/lib/feed-content";

const SOURCE_FEED = "https://www.dukagjini.com/feed/";
const SITE_ORIGIN = "https://www.dukagjini.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeXml(value: string) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, code: string) => {
      if (code[0] === "#") {
        const hex = code[1]?.toLowerCase() === "x";
        const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
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
}

function getTag(item: string, name: string) {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}\\s*>`, "i").exec(item);
  if (!match) return "";

  const value = match[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(value);
  return cdata ? cdata[1].trim() : decodeXml(value);
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

function normalizeDukagjiniUrl(value: string, base = SITE_ORIGIN) {
  try {
    const url = new URL(value, base);
    if (url.hostname !== "dukagjini.com" && !url.hostname.endsWith(".dukagjini.com")) return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

function extractOpenGraphImage(html: string, articleUrl: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const property = getAttribute(tag, "property").toLowerCase();
    const name = getAttribute(tag, "name").toLowerCase();
    if (property === "og:image" || property === "og:image:url" || name === "twitter:image") {
      const imageUrl = normalizeDukagjiniUrl(getAttribute(tag, "content"), articleUrl);
      if (imageUrl) return imageUrl;
    }
  }

  return "";
}

async function getFeaturedImage(articleUrl: string) {
  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; MomentiRSS/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return "";
    const finalUrl = normalizeDukagjiniUrl(response.url);
    if (!finalUrl) return "";

    return extractOpenGraphImage(await response.text(), finalUrl);
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

function renderItem(item: string, image: string) {
  const title = getTag(item, "title");
  const link = normalizeDukagjiniUrl(getTag(item, "link"));
  if (!title || !link) return "";

  const body = removeAppearedFirstFooter((getTag(item, "content:encoded") || getTag(item, "description"))
    .replace(/<(script|style|iframe|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .trim());

  const guid = getTag(item, "guid") || link;
  const pubDate = formatPubDate(getTag(item, "pubDate"));
  const imageMarkup = image
    ? `<p><img src="${escapeXml(image)}" alt="${escapeXml(title)}" /></p>`
    : "";
  const content = `${imageMarkup}${body}<p>Burimi: <a href="${escapeXml(link)}">Dukagjini</a></p>`;
  const imageFields = image
    ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" />
      <media:content url="${escapeXml(image)}" medium="image" />`
    : "";

  return `<item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${wrapCdata(content)}</description>
      <content:encoded>${wrapCdata(content)}</content:encoded>
      <source url="${SOURCE_FEED}">Dukagjini</source>
      ${imageFields}
    </item>`;
}

export async function GET() {
  try {
    const response = await fetch(SOURCE_FEED, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return new Response("Dukagjini feed is temporarily unavailable", { status: 502 });
    }

    const xml = await response.text();
    const sourceItems = [...xml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item\s*>/gi)].map((match) => match[0]);
    const itemsWithImages = await mapWithConcurrency(sourceItems, 3, async (item) => {
      const link = normalizeDukagjiniUrl(getTag(item, "link"));
      const image = link ? await getFeaturedImage(link) : "";
      return renderItem(item, image);
    });
    const items = itemsWithImages.filter(Boolean);

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Dukagjini — Momenti Feed</title>
          <link>${SITE_ORIGIN}</link>
          <description>Lajmet e Dukagjinit me fotografi kryesore për WPeMatico.</description>
          <language>sq</language>
          <ttl>10</ttl>
          ${items.join("\n")}
        </channel>
      </rss>`;

    return new Response(feed, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Dukagjini feed adapter error:", error);
    return new Response("Dukagjini feed is temporarily unavailable", { status: 502 });
  }
}

