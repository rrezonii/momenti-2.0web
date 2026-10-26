import "server-only";

const SHORTS_PLAYLIST_ID = "PLRlSbt6802XLghr1MIJOuF5gYUFgWfmLr";
const CACHE_SECONDS = 60;
const MAX_PLAYLIST_ITEMS = 50;

export type YouTubeShort = {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeThumbnail(value: unknown): string | null {
  const thumbnail = asNonEmptyString(value);
  if (!thumbnail) return null;

  try {
    const url = new URL(thumbnail);
    return url.protocol === "https:" && /(^|\.)ytimg\.com$/i.test(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function getLatestYouTubeShorts(limit = 4): Promise<YouTubeShort[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("YOUTUBE_API_KEY is missing; using the existing homepage hero.");
    return [];
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("playlistId", SHORTS_PLAYLIST_ID);
  url.searchParams.set("maxResults", String(MAX_PLAYLIST_ITEMS));
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, {
      // Refresh the playlist lookup once per minute while limiting API quota use.
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`YouTube Shorts API returned HTTP ${response.status}; using the existing homepage hero.`);
      return [];
    }

    const payload: unknown = await response.json();
    const responseObject = asObject(payload);
    const items = responseObject?.items;
    if (!Array.isArray(items) || items.length === 0) return [];

    const shorts = items
      .map((value): YouTubeShort | null => {
        const item = asObject(value);
        const snippet = asObject(item?.snippet);
        const resourceId = asObject(snippet?.resourceId);
        const contentDetails = asObject(item?.contentDetails);
        const videoId = asNonEmptyString(resourceId?.videoId)
          ?? asNonEmptyString(contentDetails?.videoId);
        const title = asNonEmptyString(snippet?.title);
        const thumbnails = asObject(snippet?.thumbnails);
        const thumbnail = ["maxres", "standard", "high", "medium", "default"]
          .map((quality) => asObject(thumbnails?.[quality]))
          .map((entry) => safeThumbnail(entry?.url))
          .find((value): value is string => Boolean(value));

        if (!videoId || !title || !thumbnail) return null;

        return {
          videoId,
          title,
          thumbnail,
          publishedAt:
            asNonEmptyString(contentDetails?.videoPublishedAt)
            ?? asNonEmptyString(snippet?.publishedAt)
            ?? "",
        };
      })
      .filter((short): short is YouTubeShort => short !== null)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

    return shorts.slice(0, Math.max(0, Math.floor(limit)));
  } catch {
    console.error("YouTube Shorts API request failed; using the existing homepage hero.");
    return [];
  }
}

export async function getLatestYouTubeShort(): Promise<YouTubeShort | null> {
  const [short] = await getLatestYouTubeShorts(1);
  return short ?? null;
}
