import { Suspense } from "react";
import { getEditorialTopicSlugs } from "@/lib/editorial-categories";
import Image from "next/image";
import Link from "next/link";
import ArticleImage from "@/components/ArticleImage";
import DesktopYouTubeEmbed from "@/components/DesktopYouTubeEmbed";
import DeferredPromoVideo from "@/components/DeferredPromoVideo";
import type { Article } from "@/lib/types";
import { getTrendingArticleIds } from "@/lib/redis";
import { getLatestYouTubeShorts } from "@/lib/youtube";

const SHOW_YOUTUBE_TITLE = true;

function MainFeatureFallback({ locale = "sq" }: { locale?: "sq" | "en" } = {}) {
  return (
    <Link href={locale === "en" ? "/en" : "/sq"} className="main-feature-link">
      <div className="main-video-placeholder">
        <Image
          src="/images/momenti-default.jpg"
          alt=""
          fill
          sizes="(max-width: 768px) 0px, 320px"
          className="object-cover"
        />
        <div className="play-button">▶</div>
      </div>
      <h1>
        {locale === "en" ? "Latest video from Momenti" : "Shiste diploma për 300 euro, dyshohet se përfitonte nga shitja e dokumenteve"}
      </h1>
      <div className="post-meta">{locale === "en" ? "Latest video" : "30 Shtator 2026"}</div>
    </Link>
  );
}

async function YouTubeHeroContent({ locale }: { locale: "sq" | "en" }) {
  const [youtubeShort] = await getLatestYouTubeShorts(1);
  if (!youtubeShort) return <MainFeatureFallback locale={locale} />;

  return (
    <>
      <DesktopYouTubeEmbed
        videoId={youtubeShort.videoId}
        title={youtubeShort.title}
        thumbnail={youtubeShort.thumbnail}
      />
      {SHOW_YOUTUBE_TITLE && (
        <a
          className="youtube-short-title"
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeShort.videoId)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <h1>{youtubeShort.title}</h1>
        </a>
      )}
    </>
  );
}

export default async function HomeHero({ articles: latestPosts, locale = "sq" }: { articles: Article[]; locale?: "sq" | "en" }) {
  const trendingIds = await getTrendingArticleIds(5);

  const featuredPosts = latestPosts.slice(0, 3);
  const focusPosts = latestPosts.slice(3, 4);

  const trendingMap = new Map(
    latestPosts.map((post) => [post.id, post])
  );

  const rankedTrendingPosts = trendingIds
    .map((id) => trendingMap.get(id))
    .filter((post): post is (typeof latestPosts)[number] => Boolean(post));

  // Redis may be unavailable or contain IDs outside the current WordPress
  // response. Keep the section populated with recent articles in that case.
  const rankedTrendingIds = new Set(rankedTrendingPosts.map((post) => post.id));
  const featuredIds = new Set(featuredPosts.map((post) => post.id));
  const trendingPosts = [
    ...rankedTrendingPosts,
    ...latestPosts.filter(
      (post) => !rankedTrendingIds.has(post.id) && !featuredIds.has(post.id)
    ),
  ].slice(0, 5);

  const sidebarLatestPosts = latestPosts.slice(1, 3);

  const getFocusExcerpt = (excerpt?: string) => {
    if (!excerpt?.trim()) return "";
    const words = excerpt.trim().split(/\s+/);
    return words.length > 20
      ? `${words.slice(0, 20).join(" ")}…`
      : excerpt.trim();
  };

  const hrefFor = (post: { slug: string; category: string }) => {
    if (locale === "en") return `/en/article/${post.slug}`;
    switch (post.category) {
      case "Politikë":
        return `/politike/${post.slug}`;
      case "Bota":
        return `/bota/${post.slug}`;
      case "Magazinë":
        return `/magazina/${post.slug}`;
      case "Sport":
        return `/sport/${post.slug}`;
      default:
        return `/lajme/${post.slug}`;
    }
  };

  // "Më të lexuarat" (mobile) shows a topic under each title; imported posts are mostly "Lajme",
  // so use the editorial topic (politics, sport…) when one is detected.
  const topicNames: Record<string, string> = locale === "en"
    ? { politics: "Politics", world: "World", sport: "Sport", technology: "Technology", health: "Health", magazine: "Magazine" }
    : { politics: "Politikë", world: "Bota", sport: "Sport", technology: "Teknologji", health: "Shëndeti", magazine: "Magazinë" };
  const trendingTopic = (post: (typeof latestPosts)[number]) => {
    const topics = getEditorialTopicSlugs(post);
    // Most specific topic first (a sport story that mentions a country is still Sport).
    const topic = ["sport", "technology", "health", "magazine", "politics", "world"].find((slug) => topics.includes(slug));
    return topic ? topicNames[topic] : categoryLabel(post);
  };

  const categoryLabel = (post: (typeof latestPosts)[number]) => {
    if (locale === "sq") return post.category;
    const topicTag = post.terms?.map((term) => term.toLowerCase()).find((term) =>
      ["politics", "world", "sport", "technology", "health", "magazine"].some(
        (topic) => term === `momenti-en-${topic}`,
      ),
    );
    if (topicTag) {
      const topicLabels: Record<string, string> = {
        politics: "Politics",
        world: "World",
        sport: "Sport",
        technology: "Technology",
        health: "Health",
        magazine: "Magazine",
      };
      return topicLabels[topicTag.replace("momenti-en-", "")];
    }
    const labels: Record<string, string> = {
      Lajme: "News",
      "Politikë": "Politics",
      Bota: "World",
      "Magazinë": "Magazine",
      Sport: "Sport",
    };
    return labels[post.category] ?? "News";
  };

  const renderFeaturedCard = (
    post: (typeof featuredPosts)[number],
    badgeLabel: string = categoryLabel(post),
    preloadImage = false
  ) => (
    <article className="featured-card" key={post.slug}>
      <Link href={hrefFor(post)} className="featured-card-link">
        <div className="image-placeholder">
          <ArticleImage
            src={post.image}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 54vw, 620px"
            className="home-hero-article-image"
            quality={45}
            loading={preloadImage ? "eager" : undefined}
            fetchPriority={preloadImage ? "high" : undefined}
          />
          <div className="featured-image-overlay">
            <div
              className={`featured-overlay-category${badgeLabel === "Momenti i fundit" || badgeLabel === "Breaking news" ? " featured-overlay-category-latest" : ""}`}
            >
              {badgeLabel}
            </div>
            <h3>{post.title}</h3>
          </div>
        </div>
        <div className="featured-card-category">{badgeLabel}</div>
        <h3 className="featured-card-title">{post.title}</h3>
        {post.excerpt && <p className="featured-card-excerpt">{post.excerpt}</p>}
        <div className="post-meta">{post.date}</div>
      </Link>
    </article>
  );

  return (
    <section className="home-hero">
      <div className="home-hero-grid">

        {/* TË VEÇUARAT */}

        <div className="featured-column">
          <div className="featured-lead">
            <div className="section-heading">
              <span className="heading-mark" />
              <h2>
                <span className="featured-heading-desktop">{locale === "en" ? "Featured" : "Të veçuarat"}</span>
                <span className="featured-heading-mobile">{locale === "en" ? "Breaking news" : "Momenti i fundit"}</span>
              </h2>
            </div>
            {featuredPosts[0] && renderFeaturedCard(featuredPosts[0], locale === "en" ? "Breaking news" : "Momenti i fundit", true)}
          </div>

          <div className="featured-list">
            {featuredPosts.slice(1).map((post) => renderFeaturedCard(post))}
          </div>

          <section className="focus-news-section" aria-label={locale === "en" ? "In focus" : "Në fokus"}>
            <div className="focus-news-container">
              <div className="focus-news-label">
                <span aria-hidden="true">◎</span>
                <h2>{locale === "en" ? "IN FOCUS" : "NË FOKUS"}</h2>
              </div>

              <div className="focus-news-grid">
                {focusPosts.map((post) => (
                  <Link href={hrefFor(post)} className="focus-news-card" key={post.id}>
                    <div className="focus-news-image">
                      <ArticleImage src={post.image} alt="" sizes="(max-width: 768px) 40vw, 20vw" />
                    </div>
                    <div className="focus-news-copy">
                      <div className="focus-news-date">
                        {post.time ? `${post.date} • ${post.time}` : post.date}
                      </div>
                      <h3>{post.title}</h3>
                      {post.excerpt && (
                        <p className="focus-news-excerpt">
                          {getFocusExcerpt(post.excerpt)}
                        </p>
                      )}
                      <span className="focus-news-arrow" aria-hidden="true">↗</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>


        {/* VIDEO / POST KRYESOR */}

        <div className="main-feature">
          <Suspense fallback={<MainFeatureFallback locale={locale} />}>
            <YouTubeHeroContent locale={locale} />
          </Suspense>
        </div>


        {/* LATEST + TRENDING + SPONSOR */}

        <aside className="right-column">
          <div className="sidebar-latest-box">
            <div className="section-heading">
              <span className="heading-mark" />
              <h2>{locale === "en" ? "Latest news" : "Lajmet e fundit"}</h2>
            </div>

            {sidebarLatestPosts.map((post) => (
              <Link
                href={hrefFor(post)}
                className="sidebar-latest-item"
                key={post.id}
              >
                <div className="sidebar-latest-image">
                  <ArticleImage src={post.image} alt="" sizes="160px" />
                </div>
                <div className="sidebar-latest-copy">
                  <span>{categoryLabel(post)}</span>
                  <h3>{post.title}</h3>
                </div>
              </Link>
            ))}
          </div>

          <section className="home-promo-video-section" aria-label={locale === "en" ? "AIR TICKETA sponsor" : "Sponsor AIR TICKETA"}>
            <DeferredPromoVideo />
          </section>

          <div className="trending-box">
            <div className="section-heading">
              <span className="heading-mark" />
              <h2>{locale === "en" ? "Most read now" : "Më të lexuarat tani"}</h2>
            </div>

            {trendingPosts.map((post, index) => (
              <Link
                href={hrefFor(post)}
                className="trending-item"
                key={post.id}
              >
                <span className="trending-number" data-rank={index + 1}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="trending-text">
                  <h3>{post.title}</h3>
                  <span className="trending-category">{trendingTopic(post)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="sponsor-box">
            <span>{locale === "en" ? "Sponsored" : "Sponsor"}</span>

            <div className="sponsor-placeholder">
              <Image
                src="/images/sponsors/3m-express.png"
                alt="3M Express — Zgjidhja juaj për çdo dërgesë"
                fill
                sizes="(max-width: 1100px) 30vw, 300px"
                className="sponsor-ad-image sponsor-ad-desktop"
              />
              <Image
                src="/images/sponsors/3m-express-banner.jpg"
                alt="3M Express — Zgjidhja juaj për çdo dërgesë"
                fill
                sizes="(max-width: 768px) 100vw, 320px"
                className="sponsor-ad-image sponsor-ad-mobile"
              />
            </div>
          </div>

        </aside>

      </div>
    </section>
  );
}
