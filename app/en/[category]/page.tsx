import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleImage from "@/components/ArticleImage";
import ArticleCardLink from "@/components/ArticleCardLink";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryPagination from "@/components/CategoryPagination";
import { getEnglishArticles, getEnglishCategoryLabel } from "@/lib/english-content";
import type { Article } from "@/lib/types";

const categories = ["news", "politics", "world", "sport", "technology", "health", "magazine"] as const;
type EnglishCategory = (typeof categories)[number];

function isEnglishCategory(value: string): value is EnglishCategory {
  return categories.includes(value as EnglishCategory);
}

function articleHref(article: Article) {
  return `/en/article/${article.slug}`;
}

function articleDate(article: Article) {
  return article.time ? `${article.date} · ${article.time}` : article.date;
}

function categoryPageClass(category: EnglishCategory) {
  if (category === "technology") return "category-page technology-category-page";
  if (category === "health") return "category-page health-category-page";
  return "category-page";
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!isEnglishCategory(category)) return { title: "Section not found" };
  const label = getEnglishCategoryLabel(category);
  const albanianPaths: Record<EnglishCategory, string> = {
    news: "lajme", politics: "politike", world: "bota", sport: "sport",
    technology: "teknologji", health: "shendeti", magazine: "magazina",
  };
  const path = `/en/${category}`;
  return {
    title: `Latest ${label.toLowerCase()} news`,
    description: `The latest ${label.toLowerCase()} news from Kosovo, the region and the world on Momenti.`,
    alternates: {
      canonical: `https://momenti.info${path}`,
      languages: { sq: `https://momenti.info/sq/${albanianPaths[category]}`, en: `https://momenti.info${path}` },
    },
    openGraph: {
      title: `Latest ${label.toLowerCase()} news | Momenti`,
      description: `Follow the latest ${label.toLowerCase()} news on Momenti.`,
      url: `https://momenti.info${path}`,
      siteName: "Momenti",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 60;

export default async function EnglishCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ category }, query] = await Promise.all([params, searchParams]);
  if (!isEnglishCategory(category)) notFound();

  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Math.min(100, Number.parseInt(rawPage || "1", 10) || 1));
  const label = getEnglishCategoryLabel(category);
  const result = await getEnglishArticles(category, page, 12);
  const articles = result.articles;

  if (!articles.length) {
    return (
      <>
        <Header locale="en" />
        <main className={categoryPageClass(category)}>
          <section className="world-section">
            <div className="world-container">
              <div className="section-heading world-heading"><span className="heading-mark" /><h2>{label}</h2></div>
              <div className="category-empty">
                <h3>No {label.toLowerCase()} stories yet</h3>
                <p>New translated stories will appear here automatically.</p>
              </div>
            </div>
          </section>
        </main>
        <Footer locale="en" />
      </>
    );
  }

  const [mainArticle, ...remaining] = articles;
  const sideArticles = remaining.slice(0, 3);
  const otherArticles = articles.slice(4, 12);
  const hasNext = result.totalPages > page;
  const latestArticles = [...articles].sort((a, b) =>
    new Date(b.publishedAt ?? "").getTime() - new Date(a.publishedAt ?? "").getTime()
  ).slice(0, 4);
  const paginationPath = `/en/${category}`;

  return (
    <>
      <Header locale="en" />
      <main className={categoryPageClass(category)}>
        <section className="world-section">
          <div className="world-container">
            <div className="section-heading world-heading"><span className="heading-mark" /><h2>{label}</h2></div>
            <div className="world-grid">
              <ArticleCardLink href={articleHref(mainArticle)} className="world-main-card">
                <div className="world-main-image"><ArticleImage src={mainArticle.image} alt={mainArticle.title} sizes="(max-width: 768px) 100vw, 60vw" /></div>
                <div className="world-category">{label.toUpperCase()}</div>
                <h3>{mainArticle.title}</h3>
                <div className="world-date">{articleDate(mainArticle)}</div>
              </ArticleCardLink>
              <div className="world-side">
                {sideArticles.map((article) => (
                  <ArticleCardLink key={article.id} href={articleHref(article)} className="world-small-card">
                    <div className="world-small-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 40vw, 20vw" /></div>
                    <div className="world-small-content"><div className="world-category">{label.toUpperCase()}</div><h3>{article.title}</h3><div className="world-date">{articleDate(article)}</div></div>
                  </ArticleCardLink>
                ))}
              </div>
            </div>
          </div>
        </section>

        {otherArticles.length > 0 && (
          <section className="world-more-section">
            <div className="world-more-container">
              <div className="section-heading world-more-heading"><span className="heading-mark" /><h2>More from {label}</h2></div>
              <div className="world-more-grid">
                {otherArticles.map((article) => (
                  <ArticleCardLink key={article.id} href={articleHref(article)} className="world-more-card">
                    <div className="world-more-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 25vw" /></div>
                    <div className="world-category">{label.toUpperCase()}</div><h3>{article.title}</h3><div className="world-date">{articleDate(article)}</div>
                  </ArticleCardLink>
                ))}
              </div>
              <CategoryPagination path={paginationPath} page={page} hasNext={hasNext} locale="en" />
            </div>
          </section>
        )}

        <section className="world-latest-section">
          <div className="world-latest-container">
            <div className="section-heading world-latest-heading"><span className="heading-mark" /><h2>Latest</h2></div>
            <div className="world-latest-grid">
              {latestArticles.map((article) => (
                <ArticleCardLink key={article.id} href={articleHref(article)} className="world-latest-card">
                  <div className="world-latest-image"><ArticleImage src={article.image} alt={article.title} sizes="(max-width: 768px) 50vw, 25vw" /></div>
                  <div className="world-latest-content"><div className="latest-label">{label.toUpperCase()}</div><h3>{article.title}</h3><div className="world-date">{articleDate(article)}</div></div>
                </ArticleCardLink>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer locale="en" />
    </>
  );
}
