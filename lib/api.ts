import { Article } from "./types";
import { ENGLISH_LANGUAGE_TAG, getWordPressTagId } from "./translation-tags";

const WORDPRESS_URL = process.env.WORDPRESS_URL;

type WordPressCategory = {
  id: number;
  name: string;
  slug: string;
};

export type WordPressPost = {
  id: number;
  status?: string;
  date: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  slug: string;

  title: {
    rendered: string;
  };

  content?: {
    rendered: string;
  };

  excerpt: {
    rendered: string;
  };

  featured_media: number;

  categories: number[];
  tags?: number[];

  author: number;

  _embedded?: {
    ["wp:featuredmedia"]?: Array<{
      source_url: string;
      alt_text?: string;
    }>;

    ["wp:term"]?: Array<
      Array<{
        id: number;
        name: string;
        slug: string;
        taxonomy: string;
      }>
    >;

    author?: Array<{
      name: string;
    }>;
  };
};

export function stripHtml(html: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    copy: "©",
    gt: ">",
    hellip: "…",
    laquo: "«",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    raquo: "»",
    rdquo: "”",
    reg: "®",
    rsquo: "’",
    trade: "™",
    euml: "ë",
    Euml: "Ë",
    ccedil: "ç",
    Ccedil: "Ç",
  };

  const decodeEntities = (text: string) =>
    text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, reference: string) => {
      if (reference.startsWith("#")) {
        const codePoint = reference[1]?.toLowerCase() === "x"
          ? Number.parseInt(reference.slice(2), 16)
          : Number.parseInt(reference.slice(1), 10);

        if (
          !Number.isInteger(codePoint) ||
          codePoint < 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return "�";
        }

        return String.fromCodePoint(codePoint);
      }

      return namedEntities[reference] ?? entity;
    });

  // Decode twice as some WordPress content arrives double-encoded.
  return decodeEntities(decodeEntities(html.replace(/<[^>]*>/g, ""))).trim();
}

/**
 * Heq vetëm imazhin e parë nga përmbajtja.
 * Featured Image vazhdon të shfaqet veçmas në krye të artikullit.
 * Imazhet e tjera brenda artikullit mbeten.
 */
function removeFirstImage(html: string) {
  return html.replace(/<img\b[^>]*>/i, "");
}

export function getWordPressDate(date: string, dateGmt?: string) {
  if (!dateGmt) return new Date(date);

  const normalizedGmt = /(?:z|[+-]\d{2}:?\d{2})$/i.test(dateGmt)
    ? dateGmt
    : `${dateGmt}Z`;

  return new Date(normalizedGmt);
}

function formatDate(date: string, dateGmt?: string) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(getWordPressDate(date, dateGmt));
}

function formatTime(date: string, dateGmt?: string) {
  return new Intl.DateTimeFormat("sq-AL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Belgrade",
  }).format(getWordPressDate(date, dateGmt));
}

export function getWordPressPostCategory(post: WordPressPost): Article["category"] {
  const terms = post._embedded?.["wp:term"] || [];

  const categories = terms
    .flat()
    .filter((term) => term.taxonomy === "category");

  const category =
    categories[0]?.slug === "lajme"
      ? categories.find((term) => term.slug === "sport") ?? categories[0]
      : categories[0];

  if (!category) {
    return "Lajme";
  }

  switch (category.slug) {
    case "politike":
      return "Politikë";

    case "bota":
      return "Bota";

    case "magazina":
      return "Magazinë";

    case "sport":
      return "Sport";

    case "lajme":
    default:
      return "Lajme";
  }
}

const categoryPaths: Record<Article["category"], string> = {
  Lajme: "lajme",
  "Politikë": "politike",
  Bota: "bota",
  "Magazinë": "magazina",
  Sport: "sport",
};

export function getWordPressPostPath(post: WordPressPost) {
  return `${categoryPaths[getWordPressPostCategory(post)]}/${post.slug}`;
}

function getFeaturedImage(post: WordPressPost) {
  return (
    post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
    "/images/momenti-default.jpg"
  );
}

function getAuthor(post: WordPressPost) {
  return post._embedded?.author?.[0]?.name || "Momenti";
}

function getEditorialTerms(post: WordPressPost) {
  return [...new Set(
    (post._embedded?.["wp:term"] || [])
      .flat()
      .filter((term) => term.taxonomy === "category" || term.taxonomy === "post_tag")
      .flatMap((term) => [term.name, term.slug])
      .filter(Boolean)
  )];
}

export function getWordPressPostEditorialTerms(post: WordPressPost) {
  return getEditorialTerms(post);
}

export function mapWordPressPostToArticle(post: WordPressPost): Article {
  return {
    id: post.id,
    title: stripHtml(post.title.rendered),
    slug: post.slug,
    category: getWordPressPostCategory(post),
    date: formatDate(post.date, post.date_gmt),
    time: formatTime(post.date, post.date_gmt),
    publishedAt: getWordPressDate(post.date, post.date_gmt).toISOString(),
    image: getFeaturedImage(post),
    excerpt: stripHtml(post.excerpt.rendered),
    terms: getEditorialTerms(post),
    content: post.content?.rendered ? removeFirstImage(post.content.rendered) : "",
    author: getAuthor(post),
  };
}

async function getEnglishTagFilter() {
  const id = await getWordPressTagId(ENGLISH_LANGUAGE_TAG);
  return id ? `&tags_exclude=${id}` : "";
}

async function getWordPressCategories(): Promise<WordPressCategory[]> {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  const response = await fetch(
    `${WORDPRESS_URL}/wp-json/wp/v2/categories?per_page=100`,
    {
      next: {
        revalidate: 60,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `WordPress Categories API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function getWordPressPosts(
  category?: Article["category"],
  perPage = 100,
  page = 1
): Promise<WordPressPost[]> {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  let url = `${WORDPRESS_URL}/wp-json/wp/v2/posts?page=${Math.max(1, Math.floor(page))}&per_page=${safePerPage}&_embed&_fields=id,date,date_gmt,slug,title,excerpt,categories,tags,_links,_embedded`;

  if (category) {
    const categorySlugs: Record<Article["category"], string> = {
      Lajme: "lajme",
      Politikë: "politike",
      Bota: "bota",
      Magazinë: "magazina",
      Sport: "sport",
    };

    const categorySlug = categorySlugs[category];

    const categoryResponse = await fetch(
      `${WORDPRESS_URL}/wp-json/wp/v2/categories?slug=${categorySlug}`,
      {
        next: {
          revalidate: 60,
        },
      }
    );

    if (!categoryResponse.ok) {
      throw new Error(
        `WordPress category API error: ${categoryResponse.status}`
      );
    }

    const categories: WordPressCategory[] =
      await categoryResponse.json();

    if (categories.length === 0) {
      return [];
    }

    url += `&categories=${categories[0].id}`;
  }

  url += await getEnglishTagFilter();
  const response = await fetch(url, {
    next: {
      revalidate: 60,
    },
  });

  if (!response.ok) {
    throw new Error(
      `WordPress API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function fetchWordPressPostsPage(page: number, perPage = 100) {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  const response = await fetch(
    `${WORDPRESS_URL}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&_embed&_fields=id,date,date_gmt,slug,title,excerpt,categories,tags,_links,_embedded${await getEnglishTagFilter()}`,
    { next: { revalidate: 60 } }
  );

  if (!response.ok) {
    throw new Error(
      `WordPress API error: ${response.status} ${response.statusText}`
    );
  }

  return response;
}

export async function getWordPressPostPageCount(): Promise<number> {
  const pageSize = 100;
  const firstResponse = await fetchWordPressPostsPage(1, pageSize);
  const totalPages = Number(firstResponse.headers.get("X-WP-TotalPages"));

  if (Number.isInteger(totalPages) && totalPages >= 1) return totalPages;

  const firstPosts: WordPressPost[] = await firstResponse.json();
  let count = 1;
  if (firstPosts.length < pageSize) return count;

  for (let page = 2; ; page += 1) {
    let response: Response;
    try {
      response = await fetchWordPressPostsPage(page, pageSize);
    } catch (error) {
      if (String(error).includes("WordPress API error: 400")) return count;
      throw error;
    }
    const pagePosts: WordPressPost[] = await response.json();
    count = page;
    if (pagePosts.length < pageSize) return count;
  }
}

export async function getWordPressPostsSince(since: Date): Promise<WordPressPost[]> {
  const pageSize = 100;
  const sinceTime = since.getTime();
  const posts: WordPressPost[] = [];

  for (let page = 1; ; page += 1) {
    let response: Response;
    try {
      response = await fetchWordPressPostsPage(page, pageSize);
    } catch (error) {
      if (page > 1 && String(error).includes("WordPress API error: 400")) break;
      throw error;
    }

    const pagePosts: WordPressPost[] = await response.json();
    if (pagePosts.length === 0) break;

    posts.push(
      ...pagePosts.filter(
        (post) => getWordPressDate(post.date, post.date_gmt).getTime() >= sinceTime
      )
    );

    const oldestPost = pagePosts[pagePosts.length - 1];
    const oldestTime = getWordPressDate(oldestPost.date, oldestPost.date_gmt).getTime();
    if (oldestTime < sinceTime || pagePosts.length < pageSize) break;
  }

  return posts;
}

export async function getLatestHeadlines(limit = 10) {
  const posts = await getWordPressPosts(undefined, limit);

  return posts.map((post) => {
    const category = getWordPressPostCategory(post);
    const categoryPath = {
      Lajme: "lajme",
      Politikë: "politike",
      Bota: "bota",
      Magazinë: "magazina",
      Sport: "sport",
    }[category];

    return {
      id: post.id,
      title: stripHtml(post.title.rendered),
      href: `/${categoryPath}/${post.slug}`,
      publishedAt: getWordPressDate(post.date, post.date_gmt).toISOString(),
    };
  });
}

export function getHeadlinesFromArticles(articles: Article[], limit = 10) {
  return articles.slice(0, limit).map((article) => {
    const categoryPath = {
      Lajme: "lajme",
      Politikë: "politike",
      Bota: "bota",
      Magazinë: "magazina",
      Sport: "sport",
    }[article.category];

    return {
      id: article.id,
      title: article.title,
        href: `/sq/${categoryPath}/${article.slug}`,
      publishedAt: article.publishedAt ?? "",
    };
  });
}

export async function getWordPressArticles(
  category?: Article["category"],
  limit = 100
): Promise<Article[]> {
  const safeLimit = Math.max(0, Math.floor(limit));
  const pageSize = Math.min(100, Math.max(1, safeLimit));
  const pageCount = Math.ceil(safeLimit / pageSize);
  const posts: WordPressPost[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    let pagePosts: WordPressPost[];
    try {
      pagePosts = await getWordPressPosts(category, pageSize, page);
    } catch (error) {
      // WordPress returns HTTP 400 when a requested page is past the archive.
      if (page > 1 && String(error).includes("400")) break;
      throw error;
    }
    posts.push(...pagePosts);
    if (pagePosts.length < pageSize) break;
  }

  return posts.map(mapWordPressPostToArticle);
}

/** Articles by WordPress id, in the order given (missing/unpublished ids are skipped). */
export async function getWordPressArticlesByIds(ids: number[]): Promise<Article[]> {
  const wanted = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 20);
  if (!WORDPRESS_URL || wanted.length === 0) return [];
  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts?include=${wanted.join(",")}&per_page=${wanted.length}&_embed&_fields=id,date,date_gmt,slug,title,excerpt,categories,tags,_links,_embedded`;
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
  const posts: WordPressPost[] = await response.json();
  const byId = new Map(posts.map((post) => [post.id, mapWordPressPostToArticle(post)]));
  return wanted.map((id) => byId.get(id)).filter((article): article is Article => Boolean(article));
}

export async function searchWordPressArticles(query: string): Promise<Article[]> {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    search: query,
    per_page: "40",
    _embed: "1",
    orderby: "relevance",
    order: "desc",
  }).toString();
  const englishTagId = await getWordPressTagId(ENGLISH_LANGUAGE_TAG);
  if (englishTagId) url.searchParams.set("tags_exclude", String(englishTagId));

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error(`WordPress Search API error: ${response.status} ${response.statusText}`);
  }

  const posts: WordPressPost[] = await response.json();
  return posts.map((post) => ({
    id: post.id,
    title: stripHtml(post.title.rendered),
    slug: post.slug,
    category: getWordPressPostCategory(post),
    date: formatDate(post.date, post.date_gmt),
    time: formatTime(post.date, post.date_gmt),
    publishedAt: getWordPressDate(post.date, post.date_gmt).toISOString(),
    image: getFeaturedImage(post),
    excerpt: stripHtml(post.excerpt.rendered),
    content: post.content?.rendered ? removeFirstImage(post.content.rendered) : "",
    author: getAuthor(post),
  }));
}

// KFL hides sport and advertising posts: they are not used for photo-news.
const KFL_HIDDEN_CATEGORY = /^sport|reklam|sponsor|sponzor|promo|advertorial|marketing/i;

/** WordPress categories hidden from the KFL article list (sport + advertising), with their ids. */
export async function getKflHiddenCategories(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const categories = await getWordPressCategories();
  return categories
    .filter((category) => KFL_HIDDEN_CATEGORY.test(category.slug) || KFL_HIDDEN_CATEGORY.test(stripHtml(category.name)))
    .map((category) => ({ id: category.id, name: stripHtml(category.name), slug: category.slug }));
}

export async function getWordPressArticlesPage(
  page = 1,
  perPage = 20,
  maxArticles = Number.POSITIVE_INFINITY,
  excludeCategoryIds: number[] = []
): Promise<{ articles: Article[]; totalPages: number; total: number }> {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  const requestedPage = Math.max(1, Math.floor(page));
  const safeMaxArticles = Number.isFinite(maxArticles)
    ? Math.max(1, Math.floor(maxArticles))
    : Number.POSITIVE_INFINITY;
  const maxAllowedPages = Number.isFinite(safeMaxArticles)
    ? Math.max(1, Math.ceil(safeMaxArticles / safePerPage))
    : Number.POSITIVE_INFINITY;
  const safePage = Math.min(requestedPage, maxAllowedPages);
  const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/posts`);
  url.search = new URLSearchParams({
    page: String(safePage),
    per_page: String(safePerPage),
    _embed: "1",
    orderby: "date",
    order: "desc",
  }).toString();
  const englishTagId = await getWordPressTagId(ENGLISH_LANGUAGE_TAG, true);
  if (englishTagId) url.searchParams.set("tags_exclude", String(englishTagId));
  if (excludeCategoryIds.length) url.searchParams.set("categories_exclude", excludeCategoryIds.join(","));

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
  }

  const posts: WordPressPost[] = await response.json();
  const articles = posts.filter((post) => !isEnglishTranslation(post, englishTagId)).map((post) => ({
    id: post.id,
    title: stripHtml(post.title.rendered),
    slug: post.slug,
    category: getWordPressPostCategory(post),
    date: formatDate(post.date, post.date_gmt),
    time: formatTime(post.date, post.date_gmt),
    publishedAt: getWordPressDate(post.date, post.date_gmt).toISOString(),
    image: getFeaturedImage(post),
    excerpt: stripHtml(post.excerpt.rendered),
    content: post.content?.rendered ? removeFirstImage(post.content.rendered) : "",
    author: post._embedded?.author?.[0]?.name,
  }));

  const total = Number(response.headers.get("X-WP-Total") || articles.length);
  const totalPages = Number(response.headers.get("X-WP-TotalPages") || 1);

  return {
    articles,
    totalPages: Math.min(totalPages, maxAllowedPages),
    total: Math.min(total, safeMaxArticles),
  };
}

function isEnglishTranslation(post: WordPressPost, englishTagId: number | null) {
  return post.slug.startsWith("en-") ||
    Boolean(englishTagId && post.tags?.includes(englishTagId)) ||
    Boolean(post._embedded?.["wp:term"]?.flat().some(
      (term) => term.taxonomy === "post_tag" && term.slug === ENGLISH_LANGUAGE_TAG
    ));
}

export async function getWordPressArticleBySlug(
  slug: string,
  albanianOnly = false
): Promise<Article | undefined> {
  if (!WORDPRESS_URL) {
    throw new Error("WORDPRESS_URL nuk është vendosur në .env.local");
  }

  if (albanianOnly && slug.startsWith("en-")) return undefined;
  const englishTagId = albanianOnly
    ? await getWordPressTagId(ENGLISH_LANGUAGE_TAG, true)
    : null;
  const url = `${WORDPRESS_URL}/wp-json/wp/v2/posts?slug=${encodeURIComponent(
    slug
  )}&_embed`;

  const response = await fetch(url, {
    next: {
      revalidate: 60,
    },
  });

  if (!response.ok) {
    throw new Error(
      `WordPress API error: ${response.status} ${response.statusText}`
    );
  }

  const posts: WordPressPost[] = await response.json();

  const post = posts[0];

  if (!post || (albanianOnly && isEnglishTranslation(post, englishTagId))) {
    return undefined;
  }

  return {
    id: post.id,
    title: stripHtml(post.title.rendered),
    slug: post.slug,
    category: getWordPressPostCategory(post),
    date: formatDate(post.date, post.date_gmt),
    time: formatTime(post.date, post.date_gmt),
    publishedAt: getWordPressDate(post.date, post.date_gmt).toISOString(),
    modifiedAt: post.modified
      ? getWordPressDate(post.modified, post.modified_gmt).toISOString()
      : undefined,
    image: getFeaturedImage(post),
    excerpt: stripHtml(post.excerpt.rendered),

    // Featured Image shfaqet veçmas në krye.
    // Heqim vetëm foton e parë nga content-i.
    content: post.content?.rendered ? removeFirstImage(post.content.rendered) : "",

    author: getAuthor(post),
  };
}
