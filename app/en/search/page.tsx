import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { searchEnglishArticles } from "@/lib/english-content";
import type { Article } from "@/lib/types";

export const metadata: Metadata = {
  title: "Search articles",
  robots: { index: false, follow: true },
};

export const revalidate = 60;

function categoryLabel(article: Article) {
  const topic = article.terms?.map((term) => term.toLowerCase()).find((term) =>
    ["politics", "world", "sport", "technology", "health", "magazine"].some(
      (slug) => term === `momenti-en-${slug}`,
    ),
  );
  if (topic) return topic.replace("momenti-en-", "").toUpperCase();

  const labels: Record<Article["category"], string> = {
    Lajme: "NEWS",
    "Politikë": "POLITICS",
    Bota: "WORLD",
    "Magazinë": "MAGAZINE",
    Sport: "SPORT",
  };
  return labels[article.category];
}

export default async function EnglishSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().slice(0, 120);

  let articles: Article[] = [];
  let unavailable = false;
  if (query.length >= 2) {
    try {
      articles = await searchEnglishArticles(query);
    } catch (error) {
      console.error("English WordPress search failed:", error);
      unavailable = true;
    }
  }

  return (
    <>
      <Header locale="en" />
      <main className="search-page">
        <div className="search-page-container">
          <div className="section-heading search-page-heading">
            <span className="heading-mark" />
            <h1>Search articles</h1>
          </div>

          {query && <p className="search-query-label">Results for: <strong>{query}</strong></p>}
          {!query && <p className="search-message">Enter a word or name to find articles.</p>}
          {query.length === 1 && <p className="search-message">Enter at least 2 characters.</p>}
          {unavailable && <p className="search-message">Search is temporarily unavailable. Please try again shortly.</p>}
          {query.length >= 2 && !unavailable && articles.length === 0 && (
            <p className="search-message">No articles were found for this search.</p>
          )}

          {articles.length > 0 && (
            <div className="search-results-grid">
              {articles.map((article) => (
                <Link key={article.id} href={`/en/article/${article.slug}`} className="search-result-card">
                  <div className="search-result-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={article.image} alt={article.title} />
                  </div>
                  <div className="search-result-content">
                    <span className="search-result-category">{categoryLabel(article)}</span>
                    <h2>{article.title}</h2>
                    {article.excerpt && <p>{article.excerpt}</p>}
                    <time>{article.date}{article.time ? ` · ${article.time}` : ""}</time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer locale="en" />
    </>
  );
}
