import { NextRequest, NextResponse } from "next/server";

const ALBANIAN_TO_ENGLISH: Record<string, string> = {
  "/": "/en",
  "/lajme": "/en/news",
  "/politike": "/en/politics",
  "/bota": "/en/world",
  "/sport": "/en/sport",
  "/teknologji": "/en/technology",
  "/shendeti": "/en/health",
  "/magazina": "/en/magazine",
};

const ENGLISH_TO_ALBANIAN: Record<string, string> = {
  "/en": "/sq",
  "/en/news": "/sq/lajme",
  "/en/politics": "/sq/politike",
  "/en/world": "/sq/bota",
  "/en/sport": "/sq/sport",
  "/en/technology": "/sq/teknologji",
  "/en/health": "/sq/shendeti",
  "/en/magazine": "/sq/magazina",
};

function getPreferredLanguage(acceptLanguage: string | null) {
  if (!acceptLanguage) return "en";

  const preferences = acceptLanguage
    .split(",")
    .map((entry, order) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;

      return {
        tag: tag?.trim().toLowerCase() ?? "",
        quality: Number.isFinite(quality) ? Math.min(Math.max(quality, 0), 1) : 0,
        order,
      };
    })
    .filter(({ tag, quality }) => tag && tag !== "*" && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.order - b.order);

  const preferredSupportedTag = preferences.find(({ tag }) => tag.startsWith("sq") || tag.startsWith("en"))?.tag;
  if (preferredSupportedTag) return preferredSupportedTag.startsWith("sq") ? "sq" : "en";
  return "en";
}

function getVisitorCountry(request: NextRequest) {
  return (
    request.headers.get("x-country-code") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    ""
  ).trim().toUpperCase();
}

function isProductionSite() {
  return process.env.NODE_ENV === "production";
}

function redirectWithoutCaching(url: URL) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Accept-Language, Referer, X-Country-Code, CF-IPCountry, X-Vercel-IP-Country");
  return response;
}

function getReferrerLocale(request: NextRequest): "sq" | "en" | null {
  const referrer = request.headers.get("referer");
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    if (url.origin !== request.nextUrl.origin) return null;
    if (url.pathname === "/sq" || url.pathname.startsWith("/sq/")) return "sq";
    if (url.pathname === "/en" || url.pathname.startsWith("/en/")) return "en";
  } catch {
    return null;
  }

  return null;
}

function getEnglishPath(pathname: string) {
  const categoryPath = ALBANIAN_TO_ENGLISH[pathname];
  if (categoryPath) return categoryPath;

  const articleMatch = pathname.match(/^\/lajme\/([^/]+)$/);
  if (articleMatch) return `/en/article/en-${articleMatch[1]}`;

  const categoryArticleMatch = pathname.match(/^\/(?:politike|bota|sport|teknologji|shendeti|magazina)\/([^/]+)$/);
  if (categoryArticleMatch) return `/en/article/en-${categoryArticleMatch[1]}`;

  return null;
}

function getAlbanianPath(pathname: string) {
  const categoryPath = ENGLISH_TO_ALBANIAN[pathname];
  if (categoryPath) return categoryPath;

  const articleMatch = pathname.match(/^\/en\/article\/en-(.+)$/);
  if (articleMatch) return `/sq/lajme/${articleMatch[1]}`;

  return null;
}

function isAlbanianPath(pathname: string) {
  return [
    "/",
    "/lajme",
    "/politike",
    "/bota",
    "/sport",
    "/teknologji",
    "/shendeti",
    "/magazina",
    "/kycu",
    "/kerko",
    "/rreth-nesh",
    "/kontakt",
    "/politika-editoriale",
    "/politika-e-privatesise",
    "/kushtet-e-perdorimit",
  ].some((base) => pathname === base || (base !== "/" && pathname.startsWith(`${base}/`)));
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const explicitLocale = request.nextUrl.searchParams.get("lang");

  // Keep KFL's path-scoped session outside public locale redirects.
  const workspacePath = pathname.replace(/^\/(?:sq|en)(?=\/|$)/, "");
  if (workspacePath === "/kycu" || workspacePath.startsWith("/kycu/")) {
    if (pathname !== workspacePath || explicitLocale === "sq" || explicitLocale === "en") {
      const url = request.nextUrl.clone();
      url.pathname = workspacePath;
      url.searchParams.delete("lang");
      return redirectWithoutCaching(url);
    }
    return NextResponse.next();
  }


  if (explicitLocale === "sq" || explicitLocale === "en") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("lang");
    const unprefixedPath = pathname.replace(/^\/(?:sq|en)(?=\/|$)/, "") || "/";
    url.pathname = explicitLocale === "en"
      ? (pathname.startsWith("/en/") || pathname === "/en" ? pathname : getEnglishPath(unprefixedPath) ?? "/en")
      : (pathname.startsWith("/sq/") || pathname === "/sq"
        ? pathname
        : getAlbanianPath(pathname) ?? (isAlbanianPath(unprefixedPath) ? (unprefixedPath === "/" ? "/sq" : `/sq${unprefixedPath}`) : "/sq"));

    return redirectWithoutCaching(url);
  }

  // /sq is the public Albanian URL space; serve it with the existing Albanian
  // routes internally while keeping the locale prefix visible in the browser.
  if (pathname === "/sq" || pathname.startsWith("/sq/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/sq" ? "/" : pathname.slice(3);
    const response = NextResponse.rewrite(url);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Accept-Language, Referer");
    return response;
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.next();
  }

  if (!isProductionSite()) return NextResponse.next();

  // Explicit locale pages keep their language for same-site navigation; for
  // direct visits, the browser's preferred language decides the URL.
  const browserLanguage = getPreferredLanguage(request.headers.get("accept-language"));
  const visitorCountry = getVisitorCountry(request);
  const language = visitorCountry === "XK"
    ? "sq"
    : browserLanguage === "sq" ? "sq" : getReferrerLocale(request) ?? browserLanguage;
  const destination =
    language === "en"
      ? getEnglishPath(pathname)
      : getAlbanianPath(pathname) ?? (isAlbanianPath(pathname) ? (pathname === "/" ? "/sq" : `/sq${pathname}`) : null);
  if (!destination || destination === pathname) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = destination;
  return redirectWithoutCaching(url);
}

export const config = {
  matcher: [
    "/",
    "/sq",
    "/sq/:path*",
    "/en/:path*",
    "/lajme/:path*",
    "/politike/:path*",
    "/bota/:path*",
    "/sport/:path*",
    "/teknologji/:path*",
    "/shendeti/:path*",
    "/magazina/:path*",
    "/kycu/:path*",
    "/kerko/:path*",
    "/rreth-nesh/:path*",
    "/kontakt/:path*",
    "/politika-editoriale/:path*",
    "/politika-e-privatesise/:path*",
    "/kushtet-e-perdorimit/:path*",
  ],
};
