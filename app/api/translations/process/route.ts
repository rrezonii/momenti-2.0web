import { timingSafeEqual } from "node:crypto";
import { processEnglishTranslationBatch } from "@/lib/translation-service";

export const runtime = "nodejs";
export const maxDuration = 120;

function hasValidSecret(request: Request) {
  const secret = process.env.ARTICLE_TRANSLATION_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mode?: unknown; limit?: unknown; page?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const mode = body.mode === "recent" ? "recent" : body.mode === "archive" ? "archive" : null;
  if (!mode) {
    return Response.json({ error: "mode must be 'archive' or 'recent'." }, { status: 400 });
  }

  const limit = Number.isInteger(body.limit) ? Number(body.limit) : 3;
  if (limit < 1 || limit > 5) {
    return Response.json({ error: "limit must be an integer from 1 to 5." }, { status: 400 });
  }

  const page = body.page === undefined ? 1 : Number(body.page);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return Response.json({ error: "page must be an integer from 1 to 100000." }, { status: 400 });
  }

  try {
    const result = await processEnglishTranslationBatch(mode, limit, page);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: String(error).slice(0, 800) },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
