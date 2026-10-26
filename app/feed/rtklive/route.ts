import { removeAppearedFirstFooter } from "@/lib/feed-content";

const SOURCE_FEED = "https://www.rtklive.com/sq/feed/";
const FEED_ORIGIN = "https://www.rtklive.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getTag(item: string, tag: string) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, "i").exec(item);
  if (!match) return "";
  return decodeXml(match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim());
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

function normalizeArticleUrl(value: string) {
  try {
    const url = new URL(value, FEED_ORIGIN);
    if (url.hostname !== "rtklive.com" && url.hostname !== "www.rtklive.com") return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

function getFirstImage(html: string) {
  const match = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i.exec(html);
  if (!match) return "";
  return normalizeArticleUrl(match[2]);
}

function getArticleBody(articleHtml: string) {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article\s*>/i.exec(articleHtml)?.[1] ?? articleHtml;

  return article
    .replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, "")
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure\s*>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function formatPubDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toUTCString() : parsed.toUTCString();
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)).toUTCString();
}

function renderItem(item: string) {
  const title = getTag(item, "title");
  const link = normalizeArticleUrl(getTag(item, "link"));
  if (!title || !link) return "";

  const rawContent = getTag(item, "content");
  const articleHtml = rawContent
    .replace(/^\s*<!\[CDATA\[/i, "")
    .replace(/\]\]>\s*$/, "");
  const image = getFirstImage(articleHtml);
  const body = removeAppearedFirstFooter(getArticleBody(articleHtml));
  const guid = getTag(item, "guid") || link;
  const pubDate = formatPubDate(getTag(item, "pubDate"));
  const imageFields = image
    ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" />
      <media:content url="${escapeXml(image)}" medium="image" />`
    : "";
  const imageMarkup = image
    ? `<p><img src="${escapeXml(image)}" alt="${escapeXml(title)}" /></p>`
    : "";
  const articleContent = `${imageMarkup}${body}<p>Burimi: <a href="${link}">RTKLive</a></p>`;

  return `<item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${wrapCdata(articleContent)}</description>
      <content:encoded>${wrapCdata(articleContent)}</content:encoded>
      <source url="${SOURCE_FEED}">RTKLive</source>
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
      return new Response("RTKLive feed is temporarily unavailable", { status: 502 });
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)]
      .map((match) => renderItem(match[1]))
      .filter(Boolean);

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>RTKLive — Momenti Feed</title>
          <link>${FEED_ORIGIN}/sq/</link>
          <description>Lajmet e RTKLive me imazhe të formatuara për lexues RSS.</description>
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
    console.error("RTKLive feed adapter error:", error);
    return new Response("RTKLive feed is temporarily unavailable", { status: 502 });
  }
}

