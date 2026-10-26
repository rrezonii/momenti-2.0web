import { getWordPressPostPageCount } from "@/lib/api";

const BASE_URL = "https://momenti.info";

export const revalidate = 300;

export async function GET() {
  const totalPages = await getWordPressPostPageCount();
  const entries = Array.from({ length: totalPages }, (_, id) =>
    `  <sitemap><loc>${BASE_URL}/sitemap/${id}.xml</loc></sitemap>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
