import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryPagination from "@/components/CategoryPagination";
import { getEditorialSectionArticles } from "@/lib/editorial-categories";

export const metadata: Metadata = {
  title: "Lajme nga politika e Kosovës",
  description:
    "Lajmet më të fundit nga politika e Kosovës, zhvillimet politike dhe deklaratat e figurave kryesore në Momenti.",
  alternates: {
    canonical: "https://momenti.info/sq/politike",
    languages: { sq: "https://momenti.info/sq/politike", en: "https://momenti.info/en/politics" },
  },
  openGraph: {
    title: "Lajme nga politika e Kosovës | Momenti",
    description:
      "Lajmet më të fundit nga politika e Kosovës në Momenti.",
    url: "https://momenti.info/sq/politike",
    siteName: "Momenti",
    type: "website",
    locale: "sq_AL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lajme nga politika e Kosovës | Momenti",
    description:
      "Lajmet më të fundit nga politika e Kosovës në Momenti.",
  },
};

export const revalidate = 60;

export default async function PolitikePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = Math.min(50, Math.max(1, Number.parseInt(query.page || "1", 10) || 1));
  const archiveLimit = 4 + page * 8 + 1;
  const articles = await getEditorialSectionArticles("Politikë", archiveLimit, true);

  if (!articles.length) {
    return (
      <>
        <Header />

        <main className="category-page">
          <section className="world-section">
            <div className="world-container">
              <div className="section-heading world-heading">
                <span className="heading-mark" />
                <h2>Politikë</h2>
              </div>

              <div className="category-empty">
                <h3>Nuk ka artikuj në këtë kategori</h3>
                <p>
                  Sapo të publikohen artikuj të rinj, ata do të shfaqen këtu.
                </p>
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
    .sort((a, b) => {
      const dateA = `${a.date} ${a.time || ""}`;
      const dateB = `${b.date} ${b.time || ""}`;

      return dateB.localeCompare(dateA);
    })
    .slice(0, 4);

  return (
    <>
      <Header />

      <main className="category-page">
        {/* POLITIKË - LAJMET KRYESORE */}

        <section className="world-section">
          <div className="world-container">
            <div className="section-heading world-heading">
              <span className="heading-mark" />
              <h2>Politikë</h2>
            </div>

            <div className="world-grid">
              {/* ARTIKULLI KRYESOR */}

              <a
                href={`/politike/${mainArticle.slug}`}
                className="world-main-card"
              >
                <div className="world-main-image">
                  <img
                    src={mainArticle.image}
                    alt={mainArticle.title}
                  />
                </div>

                <div className="world-category">POLITIKË</div>

                <h3>{mainArticle.title}</h3>

                <div className="world-date">
                  {mainArticle.date}
                  {mainArticle.time ? ` • ${mainArticle.time}` : ""}
                </div>
              </a>

              {/* ARTIKUJT ANËSORË */}

              <div className="world-side">
                {sideArticles.map((article) => (
                  <a
                    key={article.id}
                    href={`/politike/${article.slug}`}
                    className="world-small-card"
                  >
                    <div className="world-small-image">
                      <img
                        src={article.image}
                        alt={article.title}
                      />
                    </div>

                    <div className="world-small-content">
                      <div className="world-category">POLITIKË</div>

                      <h3>{article.title}</h3>

                      <div className="world-date">
                        {article.date}
                        {article.time
                          ? ` • ${article.time}`
                          : ""}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TË TJERA NGA POLITIKA */}

        {otherArticles.length > 0 && (
          <section className="world-more-section">
            <div className="world-more-container">
              <div className="section-heading world-more-heading">
                <span className="heading-mark" />
                <h2>Të tjera nga Politika</h2>
              </div>

              <div className="world-more-grid">
                {otherArticles.map((article) => (
                  <a
                    key={article.id}
                    href={`/politike/${article.slug}`}
                    className="world-more-card"
                  >
                    <div className="world-more-image">
                      <img
                        src={article.image}
                        alt={article.title}
                      />
                    </div>

                    <div className="world-category">POLITIKË</div>

                    <h3>{article.title}</h3>

                    <div className="world-date">
                      {article.date}
                      {article.time
                        ? ` • ${article.time}`
                        : ""}
                    </div>
                  </a>
                ))}
              </div>
              <CategoryPagination path="/politike" page={page} hasNext={hasNext} />
            </div>
          </section>
        )}

        {/* TË FUNDIT */}

        <section className="world-latest-section">
          <div className="world-latest-container">
            <div className="section-heading world-latest-heading">
              <span className="heading-mark" />
              <h2>Të fundit</h2>
            </div>

            <div className="world-latest-grid">
              {latestArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/politike/${article.slug}`}
                  className="world-latest-card"
                >
                  <div className="world-latest-image">
                    <img
                      src={article.image}
                      alt={article.title}
                    />
                  </div>

                  <div className="world-latest-content">
                    <div className="latest-label">POLITIKË</div>

                    <h3>{article.title}</h3>

                    <div className="world-date">
                      {article.date}
                      {article.time
                        ? ` • ${article.time}`
                        : ""}
                    </div>
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
