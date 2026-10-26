import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

const redis = redisUrl
  ? createClient({
      url: redisUrl,
      socket: { connectTimeout: 2500 },
    })
  : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis error:", error);
  });
}

let redisConnection: Promise<void> | null = null;

export async function getRedis() {
  if (!redis) {
    return null;
  }

  if (!redisConnection) {
    redisConnection = redis.connect().then(() => undefined);
  }

  await redisConnection;

  return redis;
}

export async function getTrendingArticleIds(limit = 5) {
  const redis = await getRedis();

  if (!redis) {
    return [];
  }

  try {
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);

    const keys: string[] = [];

    for (let i = 0; i < 24; i++) {
      const hour = new Date(currentHour);
      hour.setHours(hour.getHours() - i);

      const hourKey = hour.toISOString().slice(0, 13);
      keys.push(`momenti:views:${hourKey}`);
    }

    const hourlyResults = await Promise.all(
      keys.map((key) => redis.zRangeWithScores(key, 0, -1))
    );
    const totals = new Map<string, number>();

    for (const items of hourlyResults) {
      for (const item of items) {
        const current = totals.get(item.value) || 0;
        totals.set(item.value, current + Number(item.score));
      }
    }

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([articleId]) => Number(articleId));
  } catch {
    return [];
  }
}
