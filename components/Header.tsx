import Link from "next/link";
import Image from "next/image";
import { getLatestHeadlines } from "@/lib/api";
import { getEnglishArticles } from "@/lib/english-content";
import LatestNewsTicker from "@/components/LatestNewsTicker";
import MobileSearch from "@/components/MobileSearch";
import DesktopNavigation from "@/components/DesktopNavigation";
import SocialLinks from "@/components/SocialLinks";

type HeaderProps = {
  initialHeadlines?: Awaited<ReturnType<typeof getLatestHeadlines>>;
  locale?: "sq" | "en";
};

export default async function Header({ initialHeadlines, locale = "sq" }: HeaderProps = {}) {
  let latestHeadlines = initialHeadlines ?? [];
  if (!initialHeadlines) {
    try {
      if (locale === "en") {
        const { articles } = await getEnglishArticles(undefined, 1, 10);
        latestHeadlines = articles.map((article) => ({
          id: article.id,
          title: article.title,
          href: `/en/article/${article.slug}`,
          publishedAt: article.publishedAt ?? "",
        }));
      } else {
        latestHeadlines = await getLatestHeadlines(10);
      }
    } catch {
      // Keep the header and navigation usable while WordPress is unavailable.
    }
  }

  const searchForm = (className: string) => (
    <form
      action={locale === "en" ? "/en/search" : "/sq/kerko"}
      method="get"
      role="search"
      className={className}
    >
      <label
        className="sr-only"
        htmlFor={`article-search-${className.replace(/\s+/g, "-")}`}
      >
        {locale === "en" ? "Search articles" : "Kërko artikuj"}
      </label>
      <input
        id={`article-search-${className.replace(/\s+/g, "-")}`}
        type="search"
        name="q"
        placeholder={locale === "en" ? "Search articles..." : "Kërko artikuj..."}
        aria-label={locale === "en" ? "Search articles" : "Kërko artikuj"}
        minLength={2}
        maxLength={120}
        required
      />
      <button type="submit" aria-label={locale === "en" ? "Search" : "Kërko"}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </button>
    </form>
  );

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="momenti-container header-top-inner">
          <MobileSearch locale={locale} />

          <SocialLinks className="social-links" />

          <Link href={locale === "en" ? "/en" : "/sq"} className="site-logo" aria-label="Momenti">
            <Image
              src="/logo.png"
              alt="Momenti"
              width={1080}
              height={280}
              sizes="320px"
              // Above the fold on every page: load it at once instead of lazily, so it never pops in late.
              loading="eager"
              fetchPriority="high"
              className="site-logo-image"
            />
          </Link>

          <div className="header-spacer" />
        </div>
      </div>

      <nav className="main-navigation">
        <div className="momenti-container nav-inner">
          <DesktopNavigation locale={locale} />
          {searchForm("header-search header-search-desktop")}
        </div>
      </nav>
      <LatestNewsTicker items={latestHeadlines} locale={locale} />
    </header>
  );
}
