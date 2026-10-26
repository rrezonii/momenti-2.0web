import { Suspense } from "react";
import Link from "next/link";
import ArticleImage from "@/components/ArticleImage";
import ArticleCardLink from "@/components/ArticleCardLink";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeHero from "@/components/HomeHero";
import YouTubeShortsSection from "@/components/YouTubeShortsSection";
import { getEnglishArticles } from "@/lib/english-content";
import type { Article } from "@/lib/types";

function storyHref(article: Article) {
  return `/en/article/${article.slug}`;
}

function storyDate(article: Article) {
  return article.time ? `${article.date} · ${article.time}` : article.date;
}

function storyCategory(article: Article) {
  const labels: Record<string, string> = {
    Lajme: "News",
    "Politikë": "Politics",
    Bota: "World",
    "Magazinë": "Magazine",
    Sport: "Sport",
  };
  const topicTag = article.terms?.map((term) => term.toLowerCase()).find((term) =>
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
  return labels[article.category] ?? "News";
}

function headlineItems(articles: Article[]) {
  return articles.slice(0, 10).map((article) => ({
    id: article.id,
    title: article.title,
    href: storyHref(article),
    publishedAt: article.publishedAt ?? "",
  }));
}

function CategoryBlock({ title, label, href, articles, variant }: { title: string; label: string; href: string; articles: Article[]; variant: "sport" | "technology" | "health" }) {
  if (!articles.length) return null;
  const [lead, ...remaining] = articles;
  const styles = {
    sport: {
      section: "sport-section sport-home-section", container: "politics-container sport-home-container",
      heading: "section-heading politics-heading sport-home-heading", more: "sport-home-more",
      grid: "politics-grid sport-home-grid", mainCard: "politics-main-card sport-home-main-card",
      mainImage: "politics-main-image sport-home-main-image", mainDetails: "politics-main-details sport-home-main-details",
      category: "politics-category sport-home-category", side: "politics-side sport-home-side",
      smallCard: "politics-small-card sport-home-small-card", smallImage: "politics-small-image sport-home-small-image",
      smallContent: "politics-small-content", categoryText: "politics-category sport-home-category-text",
    },
    technology: {
      section: "technology-home-section", container: "politics-container technology-home-container",
      heading: "section-heading politics-heading technology-home-heading", more: "technology-home-more",
      grid: "politics-grid technology-home-grid", mainCard: "politics-main-card technology-home-main-card",
      mainImage: "politics-main-image technology-home-main-image", mainDetails: "politics-main-details technology-home-main-details",
      category: "politics-category technology-home-category", side: "politics-side technology-home-side",
      smallCard: "politics-small-card technology-home-small-card", smallImage: "politics-small-image technology-home-small-image",
      smallContent: "politics-small-content", categoryText: "politics-category technology-home-category-text",
    },
    health: {
      section: "health-home-section", container: "politics-container health-home-container",
      heading: "section-heading politics-heading health-home-heading", more: "health-home-more",
      grid: "politics-grid health-home-grid", mainCard: "politics-main-card health-home-main-card",
      mainImage: "politics-main-image health-home-main-image", mainDetails: "politics-main-details health-home-main-details",
      category: "politics-category health-home-category", side: "politics-side health-home-side",
      smallCard: "politics-small-card health-home-small-card", smallImage: "politics-small-image health-home-small-image",
      smallContent: "politics-small-content health-home-small-content", categoryText: "politics-category health-home-category-text",
    },
  }[variant];

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <span className="heading-mark" />
          <h2>{title}</h2>
          <Link className={styles.more} href={href}>All {title.toLowerCase()} news <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.grid}>
          <ArticleCardLink href={storyHref(lead)} className={styles.mainCard}>
            <div className={styles.mainImage}>
              <ArticleImage src={lead.image} alt={lead.title} sizes="(max-width: 768px) 100vw, 60vw" />
              <span className={styles.category}>{label.toUpperCase()}</span>
              <h3>{lead.title}</h3>
            </div>
            <div className={styles.mainDetails}>
              {lead.excerpt && <p className="politics-main-summary">{lead.excerpt}</p>}
              <div className="politics-date">{storyDate(lead)}</div>
            </div>
          </ArticleCardLink>
          <div className={styles.side}>
            {remaining.slice(0, 3).map((article) => (
              <ArticleCardLink key={article.id} href={storyHref(article)} className={styles.smallCard}>
                <div className={styles.smallImage}>
                  <ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 20vw" />
                </div>
                <div className={styles.smallContent}>
                  <div className={styles.categoryText}>{label.toUpperCase()}</div>
                  <h3>{article.title}</h3>
                  <div className="politics-date">{storyDate(article)}</div>
                </div>
              </ArticleCardLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function EnglishHome() {
  const [allNews, politics, world, magazine, sports, technology, health] = await Promise.all([
    getEnglishArticles(undefined, 1, 20),
    getEnglishArticles("politics", 1, 4),
    getEnglishArticles("world", 1, 5),
    getEnglishArticles("magazine", 1, 4),
    getEnglishArticles("sport", 1, 4),
    getEnglishArticles("technology", 1, 4),
    getEnglishArticles("health", 1, 4),
  ]);

  const latestNews = allNews.articles.slice(5, 9);
  const kosovoNews = allNews.articles.slice(0, 4);
  const magazineNews = magazine.articles;
  const hrefFor = storyHref;

  return (
    <>
      <Header locale="en" initialHeadlines={headlineItems(allNews.articles)} />
      <main>
        <HomeHero articles={allNews.articles} locale="en" />

        <section className="latest-news-section">
          <div className="latest-news-container">
            <div className="section-heading latest-news-heading">
              <span className="heading-mark" />
              <h2>Latest news</h2>
              <Link className="latest-news-all" href="/en/news">All news <span aria-hidden="true">→</span></Link>
            </div>
            <div className="latest-news-grid">
              {latestNews.map((article) => (
                <ArticleCardLink href={hrefFor(article)} className="latest-news-card" key={article.id}>
                  <div className="latest-news-image">
                    <ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 25vw" />
                    <span className="latest-news-category">{storyCategory(article).toUpperCase()}</span>
                  </div>
                  <div className="latest-news-content">
                    <h3>{article.title}</h3>
                    <div className="latest-news-date">
                      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" /><path d="M8 4.4v3.9l2.7 1.6" /></svg>
                      <span>{storyDate(article)}</span>
                    </div>
                  </div>
                </ArticleCardLink>
              ))}
            </div>
          </div>
        </section>

        {politics.articles.length > 0 && (
          <section className="politics-section">
            <div className="politics-container">
              <div className="section-heading politics-heading"><span className="heading-mark" /><h2>Politics</h2></div>
              <div className="politics-grid">
                <ArticleCardLink href={storyHref(politics.articles[0])} className="politics-main-card">
                  <div className="politics-main-image">
                    <ArticleImage src={politics.articles[0].image} alt={politics.articles[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                    <span className="politics-category">POLITICS</span>
                    <h3>{politics.articles[0].title}</h3>
                  </div>
                  <div className="politics-main-details">
                    {politics.articles[0].excerpt && <p className="politics-main-summary">{politics.articles[0].excerpt}</p>}
                    <div className="politics-date">{storyDate(politics.articles[0])}</div>
                  </div>
                </ArticleCardLink>
                <div className="politics-side">
                  {politics.articles.slice(1, 4).map((article) => (
                    <ArticleCardLink key={article.id} href={storyHref(article)} className="politics-small-card">
                      <div className="politics-small-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 20vw" /></div>
                      <div className="politics-small-content"><div className="politics-category">POLITICS</div><h3>{article.title}</h3><div className="politics-date">{storyDate(article)}</div></div>
                    </ArticleCardLink>
                  ))}
                </div>
              </div>
              {politics.articles.length > 1 && (
                <div className="politics-developments" aria-label="Top developments">
                  <div className="politics-developments-label"><span className="politics-developments-bolt" aria-hidden="true">ϟ</span><span>TOP<br />STORIES</span></div>
                  <div className="politics-developments-items">{politics.articles.slice(1, 4).map((article) => <Link key={article.id} href={storyHref(article)}>{article.title}</Link>)}</div>
                  <Link className="politics-developments-more" href="/en/politics" aria-label="See all politics stories">→</Link>
                </div>
              )}
            </div>
          </section>
        )}

        {kosovoNews.length > 0 && (
          <section className="kosovo-section">
            <div className="kosovo-container">
              <div className="section-heading kosovo-heading editorial-heading"><span className="heading-mark" /><h2>Kosovo</h2><Link className="editorial-more-link" href="/en/news">See more <span aria-hidden="true">→</span></Link></div>
              <div className="kosovo-grid">
                {kosovoNews.map((article) => (
                  <ArticleCardLink key={article.id} href={storyHref(article)} className="kosovo-card">
                    <div className="kosovo-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 25vw" /></div>
                    <div className="kosovo-category">KOSOVO</div><h3>{article.title}</h3><div className="kosovo-date">{storyDate(article)}</div>
                  </ArticleCardLink>
                ))}
              </div>
            </div>
          </section>
        )}

        {sports.articles.length > 0 && <CategoryBlock title="Sport" label="Sport" href="/en/sport" articles={sports.articles} variant="sport" />}

        <Suspense fallback={null}><YouTubeShortsSection locale="en" /></Suspense>

        {technology.articles.length > 0 && <CategoryBlock title="Technology" label="Technology" href="/en/technology" articles={technology.articles} variant="technology" />}

        {world.articles.length > 0 && (
          <section className="world-section world-2026-section">
            <div className="world-container world-2026-container">
              <div className="section-heading world-heading editorial-heading world-2026-heading"><span className="heading-mark" /><h2>World</h2><Link className="editorial-more-link" href="/en/world">See more <span aria-hidden="true">→</span></Link></div>
              <div className="world-2026-grid">
                <ArticleCardLink href={storyHref(world.articles[0])} className="world-2026-lead">
                  <div className="world-2026-lead-photo">
                    <ArticleImage src={world.articles[0].image} alt={world.articles[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                    <div className="world-2026-overlay"><span className="world-2026-category">WORLD</span><h3>{world.articles[0].title}</h3><span className="world-date">{storyDate(world.articles[0])}</span></div>
                  </div>
                </ArticleCardLink>
                <div className="world-2026-stories" aria-label="Top world stories">
                  {world.articles.slice(1, 4).map((article) => (
                    <ArticleCardLink key={article.id} href={storyHref(article)} className="world-2026-story">
                      <div className="world-2026-story-photo"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 40vw, 20vw" /></div>
                      <div className="world-2026-story-copy"><span className="world-2026-category">WORLD</span><h3>{article.title}</h3><span className="world-date">{storyDate(article)}</span></div>
                    </ArticleCardLink>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {magazineNews.length > 0 && (
          <section className="magazine-section home-magazine-section">
            <div className="magazine-container">
              <div className="section-heading magazine-heading editorial-heading"><span className="heading-mark" /><h2>Magazine</h2><Link className="editorial-more-link" href="/en/magazine">See more <span aria-hidden="true">→</span></Link></div>
              <div className="magazine-grid">
                <ArticleCardLink href={storyHref(magazineNews[0])} className="magazine-main-card">
                  <div className="magazine-main-image"><ArticleImage src={magazineNews[0].image} alt={magazineNews[0].title} sizes="(max-width: 768px) 100vw, 55vw" /></div>
                  <div className="magazine-main-copy"><div className="magazine-category">MAGAZINE</div><h3>{magazineNews[0].title}</h3>{magazineNews[0].excerpt && <p className="magazine-main-summary">{magazineNews[0].excerpt}</p>}<div className="magazine-date">{storyDate(magazineNews[0])}</div></div>
                </ArticleCardLink>
                <div className="magazine-side">
                  {magazineNews.slice(1, 4).map((article) => (
                    <ArticleCardLink key={article.id} href={storyHref(article)} className="magazine-small-card">
                      <div className="magazine-small-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 40vw, 20vw" /></div>
                      <div className="magazine-small-content"><div className="magazine-category">MAGAZINE</div><h3>{article.title}</h3><div className="magazine-date">{storyDate(article)}</div></div>
                    </ArticleCardLink>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {health.articles.length > 0 && <CategoryBlock title="Health" label="Health" href="/en/health" articles={health.articles} variant="health" />}
      </main>
      <Footer locale="en" />
    </>
  );
}
