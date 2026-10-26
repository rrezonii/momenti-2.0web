import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const articleId = Number(body.articleId);

    if (!Number.isInteger(articleId) || articleId <= 0) {
      return NextResponse.json(
        { error: "articleId i pavlefshëm" },
        { status: 400 }
      );
    }

    const redis = await getRedis();

    if (!redis) {
      return NextResponse.json(
        { success: false, message: "Redis nuk është i disponueshëm" },
        { status: 503 }
      );
    }

    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13);

    const key = `momenti:views:${hourKey}`;

    await redis.zIncrBy(key, 1, String(articleId));
    await redis.expire(key, 26 * 60 * 60);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("View tracking error:", error);

    return NextResponse.json(
      { error: "Nuk u regjistrua view" },
      { status: 500 }
    );
  }
}