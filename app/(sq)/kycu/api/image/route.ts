import { isKflAuthenticated } from "@/lib/kfl/auth";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const KLAN_HOSTS = new Set(["klankosova.tv", "www.klankosova.tv"]);
const TELEGRAFI_HOSTS = new Set(["telegrafi.com", "www.telegrafi.com"]);
const EKONOMIA_HOSTS = new Set(["ekonomiaonline.com", "www.ekonomiaonline.com"]);
const RSS_SOURCE_HOSTS = new Set([
  "dukagjini.com",
  "www.dukagjini.com",
  "rtklive.com",
  "www.rtklive.com",
  "sinjali.com",
  "www.sinjali.com",
  "gazetaexpress.com",
  "www.gazetaexpress.com",
  "kosovapress.com",
  "www.kosovapress.com",
  "insajderi.org",
  "www.insajderi.org",
]);
const MOMENTI_HOSTS = new Set([
  "momenti.info",
  "www.momenti.info",
  "cms.momenti.info",
]);

function isAllowedImageUrl(url: URL) {
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443")
  ) {
    return false;
  }

  if (KLAN_HOSTS.has(url.hostname)) {
    return (
      url.pathname.startsWith("/wp-content/uploads/") ||
      url.pathname.startsWith("/uploads/")
    );
  }

  if (TELEGRAFI_HOSTS.has(url.hostname)) {
    return url.pathname.startsWith("/media-library/");
  }

  if (EKONOMIA_HOSTS.has(url.hostname)) {
    return url.pathname.startsWith("/wp-content/uploads/");
  }

  if (RSS_SOURCE_HOSTS.has(url.hostname)) {
    return (
      url.pathname.startsWith("/wp-content/uploads/") ||
      url.pathname.startsWith("/uploads/") ||
      (url.hostname === "www.rtklive.com" &&
        url.pathname.startsWith("/sq/gallery/news_original/"))
    );
  }

  if (MOMENTI_HOSTS.has(url.hostname)) {
    return (
      url.pathname.startsWith("/wp-content/uploads/") ||
      url.pathname.startsWith("/uploads/")
    );
  }

  const wordpressHost = process.env.WORDPRESS_URL
    ? new URL(process.env.WORDPRESS_URL).hostname
    : "";
  return (
    url.hostname === wordpressHost &&
    (url.pathname.startsWith("/wp-content/uploads/") ||
      url.pathname.startsWith("/uploads/"))
  );
}

function errorResponse(status: number) {
  return Response.json({ error: "Nuk mund të ngarkohej fotografia." }, { status });
}

export async function GET(request: Request) {
  if (!(await isKflAuthenticated())) {
    return errorResponse(401);
  }

  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl || rawUrl.length > 4096) {
    return errorResponse(400);
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return errorResponse(400);
  }
  if (!isAllowedImageUrl(imageUrl)) {
    return errorResponse(403);
  }

  try {
    let upstream: Response | undefined;
    let currentUrl = imageUrl;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      upstream = await fetch(currentUrl, {
        cache: "no-store",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
          "User-Agent": "Mozilla/5.0 (compatible; MomentiKFL/1.0; +https://momenti.info)",
          Referer: `${currentUrl.origin}/`,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });

      if (upstream.status < 300 || upstream.status >= 400) break;
      const location = upstream.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        return errorResponse(502);
      }

      currentUrl = new URL(location, currentUrl);
      if (!isAllowedImageUrl(currentUrl)) {
        return errorResponse(403);
      }
    }

    if (!upstream?.ok) {
      return errorResponse(502);
    }

    const contentType = upstream.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (
      !contentType ||
      !IMAGE_TYPES.has(contentType) ||
      (contentLength > 0 && contentLength > MAX_IMAGE_BYTES) ||
      !upstream.body
    ) {
      return errorResponse(415);
    }

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return errorResponse(413);
      }
      chunks.push(value);
    }

    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse(502);
  }
}
