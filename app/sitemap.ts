import type { MetadataRoute } from "next";
import {
  getWordPressDate,
  getWordPressPostPageCount,
  getWordPressPostPath,
  getWordPressPosts,
} from "@/lib/api";
import type { WordPressPost } from "@/lib/api";
import { getEnglishWordPressPostsPage } from "@/lib/english-content";

const BASE_URL = "https://momenti.info";

const PAGE_SIZE = 100;

export async function generateSitemaps() {
  const [albanianPages, englishFirstPage] = await Promise.all([
    getWordPressPostPageCount(),
    getEnglishWordPressPostsPage(1, PAGE_SIZE),
  ]);
  const totalPages = Math.max(albanianPages, englishFirstPage.totalPages);
  return Array.from({ length: totalPages }, (_, id) => ({ id }));
}

function getArticleEntries(posts: WordPressPost[]): MetadataRoute.Sitemap {
  return posts.map((post) => ({
    url: `${BASE_URL}/sq/${getWordPressPostPath(post)}`,
    lastModified: getWordPressDate(post.date, post.date_gmt),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const sitemapId = Number(await id);
  const page = Number.isInteger(sitemapId) && sitemapId >= 0 ? sitemapId + 1 : 1;
  const posts = await getWordPressPosts(undefined, PAGE_SIZE, page);
  const articles = getArticleEntries(posts);
  const englishPage = await getEnglishWordPressPostsPage(page, PAGE_SIZE);
  const englishArticles: MetadataRoute.Sitemap = englishPage.posts.map((post) => ({
    url: `${BASE_URL}/en/article/${post.slug}`,
    lastModified: getWordPressDate(post.date, post.date_gmt),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  if (page > 1) return [...articles, ...englishArticles];

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/sq`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/sq/lajme`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sq/politike`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sq/bota`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sq/sport`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sq/teknologji`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sq/shendeti`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sq/magazina`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    ...["en", "news", "politics", "world", "sport", "technology", "health", "magazine"].map((path) => ({
      url: `${BASE_URL}/${path === "en" ? "en" : `en/${path}`}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: path === "en" ? 0.9 : 0.7,
    })),
    ...[
      "rreth-nesh",
      "kontakt",
      "politika-editoriale",
      "kushtet-e-perdorimit",
      "politika-e-privatesise",
    ].map((path) => ({
      url: `${BASE_URL}/sq/${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  return [...staticEntries, ...articles, ...englishArticles];
}
