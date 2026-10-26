import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryPagination from "@/components/CategoryPagination";
import { getEditorialSectionArticles } from "@/lib/editorial-categories";
import { getCategoryPath } from "@/lib/category";
import type { Article } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shëndeti – Lajmet e fundit për shëndetin",
  description:
    "Lajmet dhe këshillat më të fundit për shëndetin, mjekësinë, mirëqenien dhe kujdesin shëndetësor në Momenti.",
  alternates: {
    canonical: "https://momenti.info/sq/shendeti",
    languages: { sq: "https://momenti.info/sq/shendeti", en: "https://momenti.info/en/health" },
  },
  openGraph: {
    title: "Shëndeti – Lajmet e fundit | Momenti",
    description:
      "Ndiqni lajmet më të fundit për shëndetin, mjekësinë dhe mirëqenien.",
    url: "https://momenti.info/sq/shendeti",
    siteName: "Momenti",
    type: "website",
    locale: "sq_AL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shëndeti – Lajmet e fundit | Momenti",
    description:
      "Ndiqni lajmet më të fundit për shëndetin, mjekësinë dhe mirëqenien.",
  },
};

export const revalidate = 60;

function articleHref(article: Article) {
  return `/${getCategoryPath(article.category)}/${article.slug}`;
}

function articleDate(article: Article) {
  return article.time ? `${article.date} • ${article.time}` : article.date;
}

export default async function ShendetiPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = Math.min(50, Math.max(1, Number.parseInt(query.page || "1", 10) || 1));
  const archiveLimit = 4 + page * 8 + 1;
  const articles = await getEditorialSectionArticles("Shëndeti", archiveLimit, true);

  if (articles.length === 0) {
    return (
      <>
        <Header />
        <main className="category-page health-category-page">
          <section className="world-section">
            <div className="world-container">
              <div className="section-heading world-heading">
                <span className="heading-mark" />
                <h2>Shëndeti</h2>
              </div>
              <div className="category-empty">
                <h3>Nuk ka artikuj për shëndetin për momentin</h3>
                <p>Lajmet për shëndetin do të shfaqen këtu sapo të publikohen.</p>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const [mainArticle, ...remainingArticles] = articles;
  const sideArticles = remainingArticles.slice(0, 3);
  const archiveStart = 4 + (page - 1) * 8;
  const otherArticles = articles.slice(archiveStart, archiveStart + 8);
  const hasNext = articles.length > archiveStart + 8;
  const latestArticles = [...articles]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 4);

  return (
    <>
      <Header />
      <main className="category-page health-category-page">
        <section className="world-section">
          <div className="world-container">
            <div className="section-heading world-heading">
              <span className="heading-mark" />
              <h2>Shëndeti</h2>
            </div>

            <div className="world-grid">
              <a href={articleHref(mainArticle)} className="world-main-card">
                <div className="world-main-image">
                  <img src={mainArticle.image} alt={mainArticle.title} />
                </div>
                <div className="world-category">SHËNDETI</div>
                <h3>{mainArticle.title}</h3>
                <div className="world-date">{articleDate(mainArticle)}</div>
              </a>

              <div className="world-side">
                {sideArticles.map((article) => (
                  <a key={article.id} href={articleHref(article)} className="world-small-card">
                    <div className="world-small-image">
                      <img src={article.image} alt={article.title} />
                    </div>
                    <div className="world-small-content">
                      <div className="world-category">SHËNDETI</div>
                      <h3>{article.title}</h3>
                      <div className="world-date">{articleDate(article)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {otherArticles.length > 0 && (
          <section className="world-more-section">
            <div className="world-more-container">
              <div className="section-heading world-more-heading">
                <span className="heading-mark" />
                <h2>Të tjera nga Shëndeti</h2>
              </div>
              <div className="world-more-grid">
                {otherArticles.map((article) => (
                  <a key={article.id} href={articleHref(article)} className="world-more-card">
                    <div className="world-more-image">
                      <img src={article.image} alt={article.title} />
                    </div>
                    <div className="world-category">SHËNDETI</div>
                    <h3>{article.title}</h3>
                    <div className="world-date">{articleDate(article)}</div>
                  </a>
                ))}
              </div>
              <CategoryPagination path="/shendeti" page={page} hasNext={hasNext} />
            </div>
          </section>
        )}

        <section className="world-latest-section">
          <div className="world-latest-container">
            <div className="section-heading world-latest-heading">
              <span className="heading-mark" />
              <h2>Të fundit</h2>
            </div>
            <div className="world-latest-grid">
              {latestArticles.map((article) => (
                <a key={article.id} href={articleHref(article)} className="world-latest-card">
                  <div className="world-latest-image">
                    <img src={article.image} alt={article.title} />
                  </div>
                  <div className="world-latest-content">
                    <div className="latest-label">SHËNDETI</div>
                    <h3>{article.title}</h3>
                    <div className="world-date">{articleDate(article)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
