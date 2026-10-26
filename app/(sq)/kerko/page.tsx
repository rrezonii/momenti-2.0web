import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { searchWordPressArticles } from "@/lib/api";
import type { Article } from "@/lib/types";

export const metadata: Metadata = {
  title: "Kërko artikuj",
  robots: { index: false, follow: true },
};

function articleHref(article: Article) {
  switch (article.category) {
    case "Politikë":
      return `/politike/${article.slug}`;
    case "Bota":
      return `/bota/${article.slug}`;
    case "Magazinë":
      return `/magazina/${article.slug}`;
    case "Sport":
      return `/sport/${article.slug}`;
    default:
      return `/lajme/${article.slug}`;
  }
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/kerko">) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().slice(0, 120);

  let articles: Article[] = [];
  let unavailable = false;
  if (query.length >= 2) {
    try {
      articles = await searchWordPressArticles(query);
    } catch (error) {
      console.error("Kërkimi në WordPress dështoi:", error);
      unavailable = true;
    }
  }

  return (
    <>
      <Header />
      <main className="search-page">
        <div className="search-page-container">
          <div className="section-heading search-page-heading">
            <span className="heading-mark" />
            <h1>Kërko artikuj</h1>
          </div>

          {query && <p className="search-query-label">Rezultatet për: <strong>{query}</strong></p>}

          {!query && (
            <p className="search-message">Shkruaj një fjalë ose emër për të gjetur artikuj.</p>
          )}
          {query.length === 1 && (
            <p className="search-message">Shkruaj të paktën 2 karaktere.</p>
          )}
          {unavailable && (
            <p className="search-message">Kërkimi nuk është i disponueshëm për momentin. Provo përsëri pas pak.</p>
          )}
          {query.length >= 2 && !unavailable && articles.length === 0 && (
            <p className="search-message">Nuk u gjet asnjë artikull për këtë kërkim.</p>
          )}

          {articles.length > 0 && (
            <div className="search-results-grid">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={articleHref(article)}
                  className="search-result-card"
                >
                  <div className="search-result-image">
                    <img src={article.image} alt={article.title} />
                  </div>
                  <div className="search-result-content">
                    <span className="search-result-category">{article.category}</span>
                    <h2>{article.title}</h2>
                    {article.excerpt && <p>{article.excerpt}</p>}
                    <time>{article.date}{article.time ? ` • ${article.time}` : ""}</time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
