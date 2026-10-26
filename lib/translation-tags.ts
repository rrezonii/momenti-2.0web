const WORDPRESS_URL = process.env.WORDPRESS_URL;

const tagIdCache = new Map<string, { id: number | null; expiresAt: number }>();

export async function getWordPressTagId(slug: string, strict = false): Promise<number | null> {
  const cached = tagIdCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.id;
  if (!WORDPRESS_URL) return null;

  try {
    const url = new URL(`${WORDPRESS_URL}/wp-json/wp/v2/tags`);
    url.search = new URLSearchParams({ slug, _fields: "id" }).toString();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`WordPress tag lookup failed: ${response.status}`);
    const tags = (await response.json()) as Array<{ id: number }>;
    const id = tags[0]?.id ?? null;
    if (id) tagIdCache.set(slug, { id, expiresAt: Date.now() + 300_000 });
    return id;
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

export function editorialTagSlug(topic: string) {
  return `momenti-en-${topic}`;
}

export const ENGLISH_LANGUAGE_TAG = "momenti-en";
