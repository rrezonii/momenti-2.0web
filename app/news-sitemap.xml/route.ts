import {
  getWordPressPostsSince,
  getWordPressDate,
  getWordPressPostPath,
  stripHtml,
} from "@/lib/api";
import { getEnglishWordPressPostsPage } from "@/lib/english-content";

const BASE_URL = "https://momenti.info";
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MAX_NEWS_SITEMAP_ENTRIES = 1000;

export const revalidate = 300;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const now = Date.now();
  const cutoff = new Date(now - TWO_DAYS_MS);
  const posts = await getWordPressPostsSince(cutoff);
  const recentPosts = posts.filter((post) => {
    const publishedAt = getWordPressDate(post.date, post.date_gmt).getTime();
    return Number.isFinite(publishedAt) && publishedAt <= now && now - publishedAt <= TWO_DAYS_MS;
  })
    .sort((a, b) => getWordPressDate(b.date, b.date_gmt).getTime() - getWordPressDate(a.date, a.date_gmt).getTime())
    .slice(0, MAX_NEWS_SITEMAP_ENTRIES);

  const { posts: englishPosts } = await getEnglishWordPressPostsPage(1, 100);
  const recentEnglishPosts = englishPosts.filter((post) => {
    const publishedAt = getWordPressDate(post.date, post.date_gmt).getTime();
    return Number.isFinite(publishedAt) && publishedAt <= now && now - publishedAt <= TWO_DAYS_MS;
  }).slice(0, Math.max(0, MAX_NEWS_SITEMAP_ENTRIES - recentPosts.length));

  const entries = recentPosts
    .map((post) => {
      const publishedAt = getWordPressDate(post.date, post.date_gmt).toISOString();
      const title = escapeXml(stripHtml(post.title.rendered));
      const url = escapeXml(`${BASE_URL}/sq/${getWordPressPostPath(post)}`);

      return `    <url>\n      <loc>${url}</loc>\n      <news:news>\n        <news:publication>\n          <news:name>Momenti</news:name>\n          <news:language>sq</news:language>\n        </news:publication>\n        <news:publication_date>${publishedAt}</news:publication_date>\n        <news:title>${title}</news:title>\n      </news:news>\n    </url>`;
    })
    .join("\n");

  const englishEntries = recentEnglishPosts
    .map((post) => {
      const publishedAt = getWordPressDate(post.date, post.date_gmt).toISOString();
      const title = escapeXml(stripHtml(post.title.rendered));
      const url = escapeXml(`${BASE_URL}/en/article/${post.slug}`);

      return `    <url>\n      <loc>${url}</loc>\n      <news:news>\n        <news:publication>\n          <news:name>Momenti</news:name>\n          <news:language>en</news:language>\n        </news:publication>\n        <news:publication_date>${publishedAt}</news:publication_date>\n        <news:title>${title}</news:title>\n      </news:news>\n    </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${entries}\n${englishEntries}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
