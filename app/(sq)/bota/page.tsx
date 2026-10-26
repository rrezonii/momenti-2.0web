import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryPagination from "@/components/CategoryPagination";
import { getEditorialSectionArticles } from "@/lib/editorial-categories";

export const metadata: Metadata = {
  title: "Lajme nga bota",
  description:
    "Lajmet më të fundit nga bota, zhvillimet ndërkombëtare dhe ngjarjet kryesore globale në Momenti.",
  alternates: {
    canonical: "https://momenti.info/sq/bota",
    languages: { sq: "https://momenti.info/sq/bota", en: "https://momenti.info/en/world" },
  },
  openGraph: {
    title: "Lajme nga bota | Momenti",
    description:
      "Lajmet më të fundit nga bota në Momenti.",
    url: "https://momenti.info/sq/bota",
    siteName: "Momenti",
    type: "website",
    locale: "sq_AL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lajme nga bota | Momenti",
    description:
      "Lajmet më të fundit nga bota në Momenti.",
  },
};

export const revalidate = 60;

export default async function BotaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = Math.min(50, Math.max(1, Number.parseInt(query.page || "1", 10) || 1));
  const archiveLimit = 4 + page * 8 + 1;
  const articles = await getEditorialSectionArticles("Bota", archiveLimit, true);

  if (!articles.length) {
    return (
      <>
        <Header />

        <main className="category-page">
          <section className="world-section">
            <div className="world-container">
              <div className="section-heading world-heading">
                <span className="heading-mark" />
                <h2>Bota</h2>
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
        {/* BOTA - LAJMET KRYESORE */}

        <section className="world-section">
          <div className="world-container">
            <div className="section-heading world-heading">
              <span className="heading-mark" />
              <h2>Bota</h2>
            </div>

            <div className="world-grid">
              {/* ARTIKULLI KRYESOR */}

              <a
                href={`/bota/${mainArticle.slug}`}
                className="world-main-card"
              >
                <div className="world-main-image">
                  <img
                    src={mainArticle.image}
                    alt={mainArticle.title}
                  />
                </div>

                <div className="world-category">BOTA</div>

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
                    href={`/bota/${article.slug}`}
                    className="world-small-card"
                  >
                    <div className="world-small-image">
                      <img
                        src={article.image}
                        alt={article.title}
                      />
                    </div>

                    <div className="world-small-content">
                      <div className="world-category">BOTA</div>

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

        {/* TË TJERA NGA BOTA */}

        {otherArticles.length > 0 && (
          <section className="world-more-section">
            <div className="world-more-container">
              <div className="section-heading world-more-heading">
                <span className="heading-mark" />
                <h2>Të tjera nga Bota</h2>
              </div>

              <div className="world-more-grid">
                {otherArticles.map((article) => (
                  <a
                    key={article.id}
                    href={`/bota/${article.slug}`}
                    className="world-more-card"
                  >
                    <div className="world-more-image">
                      <img
                        src={article.image}
                        alt={article.title}
                      />
                    </div>

                    <div className="world-category">BOTA</div>

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
              <CategoryPagination path="/bota" page={page} hasNext={hasNext} />
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
                  href={`/bota/${article.slug}`}
                  className="world-latest-card"
                >
                  <div className="world-latest-image">
                    <img
                      src={article.image}
                      alt={article.title}
                    />
                  </div>

                  <div className="world-latest-content">
                    <div className="latest-label">BOTA</div>

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
