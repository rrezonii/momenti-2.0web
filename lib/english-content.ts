import type { Article } from "./types";
import type { WordPressPost } from "./api";
import { mapWordPressPostToArticle } from "./api";
import { ENGLISH_LANGUAGE_TAG, editorialTagSlug, getWordPressTagId } from "./translation-tags";

const WORDPRESS_URL = process.env.WORDPRESS_URL;

function formatEnglishDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(new Date(value));
}

function formatEnglishTime(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Belgrade",
  }).format(new Date(value));
}

function mapEnglishPost(post: WordPressPost): Article {
  const article = mapWordPressPostToArticle(post);
  return {
    ...article,
    date: formatEnglishDate(article.publishedAt),
    time: formatEnglishTime(article.publishedAt),
  };
}

function getFeaturedImageUrl(post: WordPressPost) {
  return post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null;
}

async function getOriginalFeaturedImages(posts: WordPressPost[]) {
  if (!WORDPRESS_URL) return new Map<string, string>();

  const sourceSlugs = [...new Set(
    posts
      .filter((post) => !getFeaturedImageUrl(post) && post.slug.startsWith("en-"))
      .map((post) => post.slug.slice(3))
      .filter(Boolean),
  )];

  if (sourceSlugs.length === 0) return new Map<string, string>();

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  for (const slug of sourceSlugs) url.searchParams.append("slug[]", slug);
  url.searchParams.set("_embed", "wp:featuredmedia");
  url.searchParams.set("_fields", "slug,featured_media,_links,_embedded");
  url.searchParams.set("per_page", String(Math.min(100, sourceSlugs.length)));

  try {
    const { posts: sourcePosts } = await fetchPosts(url);
    return new Map(
      sourcePosts.flatMap((post) => {
        const image = getFeaturedImageUrl(post);
        return image ? [[post.slug, image] as const] : [];
      }),
    );
  } catch {
    // A temporary WordPress lookup failure should not take down the English
    // page; use the article's configured fallback image for this request.
    return new Map<string, string>();
  }
}

async function mapEnglishPosts(posts: WordPressPost[]) {
  const fallbackImages = await getOriginalFeaturedImages(posts);

  return posts.map((post) => {
    const article = mapEnglishPost(post);
    const originalSlug = post.slug.startsWith("en-") ? post.slug.slice(3) : "";
    const originalImage = originalSlug ? fallbackImages.get(originalSlug) : undefined;

    return {
      ...article,
      image: !getFeaturedImageUrl(post) ? originalImage ?? article.image : article.image,
    };
  });
}

async function fetchPosts(url: URL): Promise<{ posts: WordPressPost[]; total: number; totalPages: number }> {
  if (!WORDPRESS_URL) return { posts: [], total: 0, totalPages: 0 };
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) {
    if (response.status === 400) return { posts: [], total: 0, totalPages: 0 };
    throw new Error(`WordPress English articles error: ${response.status} ${response.statusText}`);
  }
  return {
    posts: (await response.json()) as WordPressPost[],
    total: Number(response.headers.get("X-WP-Total") || 0),
    totalPages: Number(response.headers.get("X-WP-TotalPages") || 1),
  };
}

export async function getEnglishWordPressPostsPage(page = 1, perPage = 100) {
  const languageTagId = await getWordPressTagId(ENGLISH_LANGUAGE_TAG);
  if (!WORDPRESS_URL || !languageTagId) return { posts: [], total: 0, totalPages: 0 };

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    tags: String(languageTagId),
    page: String(Math.max(1, Math.floor(page))),
    per_page: String(Math.min(100, Math.max(1, Math.floor(perPage)))),
    orderby: "date",
    order: "desc",
    _embed: "1",
    _fields: "id,date,date_gmt,modified,modified_gmt,slug,title,content,excerpt,categories,tags,_links,_embedded",
  }).toString();
  return fetchPosts(url);
}

export async function getEnglishArticles(
  topic: string | undefined = undefined,
  page = 1,
  perPage = 24
): Promise<{ articles: Article[]; totalPages: number; total: number }> {
  const tagId = await getWordPressTagId(
    topic && topic !== "news" ? editorialTagSlug(topic) : ENGLISH_LANGUAGE_TAG
  );
  if (!WORDPRESS_URL || !tagId) return { articles: [], totalPages: 0, total: 0 };

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    tags: String(tagId),
    page: String(Math.max(1, Math.floor(page))),
    per_page: String(Math.min(100, Math.max(1, Math.floor(perPage)))),
    orderby: "date",
    order: "desc",
    _embed: "1",
    _fields: "id,date,date_gmt,modified,modified_gmt,slug,title,content,excerpt,categories,tags,_links,_embedded",
  }).toString();

  const result = await fetchPosts(url);
  return {
    articles: await mapEnglishPosts(result.posts),
    totalPages: result.totalPages,
    total: result.total,
  };
}

export async function getEnglishArticleBySlug(slug: string): Promise<Article | undefined> {
  const tagId = await getWordPressTagId(ENGLISH_LANGUAGE_TAG);
  if (!WORDPRESS_URL || !tagId) return undefined;

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    slug,
    tags: String(tagId),
    per_page: "1",
    _embed: "1",
    _fields: "id,date,date_gmt,modified,modified_gmt,slug,title,content,excerpt,categories,tags,_links,_embedded",
  }).toString();
  const { posts } = await fetchPosts(url);
  return posts[0] ? (await mapEnglishPosts(posts))[0] : undefined;
}

export async function searchEnglishArticles(query: string): Promise<Article[]> {
  const tagId = await getWordPressTagId(ENGLISH_LANGUAGE_TAG);
  if (!WORDPRESS_URL || !tagId || query.trim().length < 2) return [];

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    search: query.trim().slice(0, 120),
    tags: String(tagId),
    per_page: "40",
    orderby: "relevance",
    order: "desc",
    _embed: "1",
    _fields: "id,date,date_gmt,modified,modified_gmt,slug,title,content,excerpt,categories,tags,_links,_embedded",
  }).toString();

  const { posts } = await fetchPosts(url);
  return mapEnglishPosts(posts);
}

export function getEnglishCategoryLabel(topic: string) {
  const labels: Record<string, string> = {
    news: "News",
    politics: "Politics",
    world: "World",
    sport: "Sport",
    technology: "Technology",
    health: "Health",
    magazine: "Magazine",
  };
  return labels[topic] ?? "News";
}

export function getEnglishCategoryHref(topic: string) {
  return topic === "news" ? "/en/news" : `/en/${topic}`;
}
