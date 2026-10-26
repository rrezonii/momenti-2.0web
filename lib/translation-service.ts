import type { Article } from "./types";
import type { WordPressPost } from "./api";
import { getWordPressPostEditorialTerms, mapWordPressPostToArticle } from "./api";
import { getEditorialTopicSlugs } from "./editorial-categories";
import { translateSqToEn } from "./argos-translator";
import { ENGLISH_LANGUAGE_TAG, editorialTagSlug, getWordPressTagId } from "./translation-tags";

const WORDPRESS_URL = process.env.WORDPRESS_URL?.replace(/\/$/, "");

function getCredentials() {
  const username = process.env.WP_TRANSLATION_USERNAME;
  const password = process.env.WP_TRANSLATION_APP_PASSWORD?.replace(/\s/g, "");
  if (!username || !password) {
    throw new Error("Set WP_TRANSLATION_USERNAME and WP_TRANSLATION_APP_PASSWORD on the server.");
  }
  if (!WORDPRESS_URL) throw new Error("Set WORDPRESS_URL on the server.");
  return {
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
}

async function wordpressRequest(path: string, init: RequestInit = {}) {
  if (!WORDPRESS_URL) throw new Error("Set WORDPRESS_URL on the server.");
  const response = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/${path}`, {
    ...init,
    headers: {
      Authorization: getCredentials().authorization,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WordPress API ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response;
}

async function findTagId(slug: string) {
  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/tags`);
  url.search = new URLSearchParams({ slug, _fields: "id" }).toString();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not read WordPress tag ${slug}: ${response.status}`);
  const tags = (await response.json()) as Array<{ id: number }>;
  return tags[0]?.id ?? null;
}

async function ensureTag(slug: string, name: string) {
  const existing = await findTagId(slug);
  if (existing) return existing;
  try {
    const response = await wordpressRequest("tags", {
      method: "POST",
      body: JSON.stringify({ slug, name }),
    });
    return ((await response.json()) as { id: number }).id;
  } catch (error) {
    const afterRace = await findTagId(slug).catch(() => null);
    if (afterRace) return afterRace;
    throw error;
  }
}

function getTranslationSlug(sourceSlug: string) {
  return `en-${sourceSlug}`;
}

async function findPublishedPostBySlug(slug: string) {
  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({ slug, per_page: "1", _fields: "id,slug,tags" }).toString();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not check translated slug: ${response.status}`);
  return ((await response.json()) as Array<{ id: number; slug: string; tags: number[] }>)[0];
}

async function getUntranslatedPosts(limit: number, mode: "archive" | "recent", page: number) {
  if (!WORDPRESS_URL) throw new Error("Set WORDPRESS_URL on the server.");
  const englishTagId = await ensureTag(ENGLISH_LANGUAGE_TAG, "Momenti English translation");
  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    status: "publish",
    tags_exclude: String(englishTagId),
    page: String(page),
    per_page: String(limit),
    orderby: "date",
    order: mode === "archive" ? "asc" : "desc",
    _embed: "1",
    _fields: "id,date,date_gmt,slug,title,content,excerpt,featured_media,categories,tags,author,_links,_embedded",
  }).toString();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not list untranslated WordPress posts: ${response.status}`);
  return {
    posts: (await response.json()) as WordPressPost[],
    languageTagId: englishTagId,
  };
}

function articleForClassification(post: WordPressPost): Article {
  const article = mapWordPressPostToArticle(post);
  article.terms = getWordPressPostEditorialTerms(post);
  return article;
}

function removeFirstImage(html: string) {
  return html.replace(/<img\b[^>]*>/i, "");
}

export type TranslationBatchResult = {
  processed: number;
  skipped: number;
  failed: Array<{ slug: string; error: string }>;
  done: boolean;
  mode: "archive" | "recent";
};

export async function processEnglishTranslationBatch(
  mode: "archive" | "recent",
  requestedLimit = 3,
  requestedPage = 1
): Promise<TranslationBatchResult> {
  getCredentials();
  const limit = Math.min(5, Math.max(1, Math.floor(requestedLimit)));
  const page = Math.max(1, Math.floor(requestedPage));
  const { posts, languageTagId } = await getUntranslatedPosts(limit, mode, page);
  if (posts.length === 0) {
    return { processed: 0, skipped: 0, failed: [], done: mode === "archive", mode };
  }

  const candidates: WordPressPost[] = [];
  let skipped = 0;
  for (const post of posts) {
    const existing = await findPublishedPostBySlug(getTranslationSlug(post.slug));
    if (existing?.tags?.includes(languageTagId)) {
      skipped += 1;
      continue;
    }
    if (existing) {
      skipped += 1;
      continue;
    }
    candidates.push(post);
  }
  if (candidates.length === 0) {
    return { processed: 0, skipped, failed: [], done: posts.length < limit && mode === "archive", mode };
  }

  const translations = await translateSqToEn(candidates.map((post) => ({
    title: post.title.rendered,
    excerpt: post.excerpt.rendered,
    content: removeFirstImage(post.content?.rendered ?? ""),
  })));
  if (translations.length !== candidates.length) {
    throw new Error("The offline translator did not return one result per article.");
  }

  const failed: TranslationBatchResult["failed"] = [];
  let processed = 0;
  for (const [index, source] of candidates.entries()) {
    const translation = translations[index];
    try {
      const article = articleForClassification(source);
      const topicSlugs = getEditorialTopicSlugs(article);
      const topicTagIds = await Promise.all(
        topicSlugs.map((topic) => ensureTag(editorialTagSlug(topic), `Momenti English: ${topic}`))
      );
      const slug = getTranslationSlug(source.slug);
      const duplicate = await findPublishedPostBySlug(slug);
      if (duplicate) {
        skipped += 1;
        continue;
      }

      await wordpressRequest("posts", {
        method: "POST",
        body: JSON.stringify({
          date: source.date,
          slug,
          status: "publish",
          title: translation.title,
          content: translation.content,
          excerpt: translation.excerpt,
          featured_media: source.featured_media,
          categories: source.categories,
          tags: [languageTagId, ...topicTagIds],
          comment_status: "closed",
          ping_status: "closed",
        }),
      });
      processed += 1;
    } catch (error) {
      failed.push({ slug: source.slug, error: String(error).slice(0, 500) });
    }
  }

  return {
    processed,
    skipped,
    failed,
    done: mode === "archive" && posts.length < limit && failed.length === 0,
    mode,
  };
}
