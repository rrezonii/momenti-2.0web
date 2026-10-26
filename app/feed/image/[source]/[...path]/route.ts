import sharp from "sharp";

// GET /feed/image/sinjali/2026/10/photo.avif.jpg
// Converts a source photo WordPress/WPeMatico can't import (AVIF, etc.) into a JPEG.
// Only the uploads folder of the listed news sources can be fetched (no open proxy).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES: Record<string, string> = {
  sinjali: "https://sinjali.com/wp-content/uploads/",
};
const MAX_BYTES = 15 * 1024 * 1024;
const SAFE_SEGMENT = /^[\w.\-%]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ source: string; path: string[] }> }) {
  const { source, path } = await params;
  const base = SOURCES[source];
  if (!base || !path?.length || path.length > 4 || !path.every((part) => SAFE_SEGMENT.test(part) && part !== "." && part !== "..")) {
    return new Response("Not found", { status: 404 });
  }
  const last = path[path.length - 1];
  if (!last.toLowerCase().endsWith(".jpg")) return new Response("Not found", { status: 404 });
  const originalPath = [...path.slice(0, -1), last.slice(0, -4)].join("/");
  const upstreamUrl = new URL(originalPath, base);
  if (!upstreamUrl.href.startsWith(base)) return new Response("Not found", { status: 404 });

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "image/*", "User-Agent": "Mozilla/5.0 (compatible; MomentiRSS/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return new Response("Image unavailable", { status: 502 });
    if (Number(upstream.headers.get("content-length") || 0) > MAX_BYTES) return new Response("Image too large", { status: 413 });
    const input = Buffer.from(await upstream.arrayBuffer());
    if (!input.length || input.length > MAX_BYTES) return new Response("Image too large", { status: 413 });

    const output = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Feed image conversion failed:", upstreamUrl.href, error);
    return new Response("Image conversion failed", { status: 502 });
  }
}
