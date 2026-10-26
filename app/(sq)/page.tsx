import { Suspense } from "react";
import ArticleImage from "@/components/ArticleImage";
import Link from "next/link";
import Header from "@/components/Header";
import HomeHero from "@/components/HomeHero";
import ArticleCardLink from "@/components/ArticleCardLink";
import YouTubeShortsSection from "@/components/YouTubeShortsSection";
import Footer from "@/components/Footer";
import { getHeadlinesFromArticles, getWordPressArticles } from "@/lib/api";
import { getEditorialSectionArticles } from "@/lib/editorial-categories";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: {
    canonical: "https://momenti.info/sq",
    languages: { sq: "https://momenti.info/sq", en: "https://momenti.info/en" },
  },
};

export default async function Home() {
  const [allNews, politics, world, magazine, sports, technology, health] = await Promise.all([
    getWordPressArticles("Lajme", 20),
    getEditorialSectionArticles("Politikë", 4),
    getEditorialSectionArticles("Bota", 5),
    getEditorialSectionArticles("Magazinë", 4),
    getEditorialSectionArticles("Sport", 4),
    getEditorialSectionArticles("Teknologji", 4, true),
    getEditorialSectionArticles("Shëndeti", 4, true),
  ]);

  const latestNews = allNews.slice(5, 9);
  const politicsNews = politics.slice(0, 4);
  const kosovoNews = allNews.slice(0, 4);
  const worldNews = world.slice(0, 5);
  const magazineNews = magazine.slice(0, 4);
  const sportsNews = sports.slice(0, 4);
  const technologyNews = technology.slice(0, 4);
  const healthNews = health.slice(0, 4);

  const hrefFor = (post: { slug: string; category: string }) => {
    switch (post.category) {
      case "Politikë": return `/politike/${post.slug}`;
      case "Bota": return `/bota/${post.slug}`;
      case "Magazinë": return `/magazina/${post.slug}`;
      case "Sport": return `/sport/${post.slug}`;
      default: return `/lajme/${post.slug}`;
    }
  };

  const postDate = (post: { date: string; time?: string }) =>
    post.time ? `${post.date} • ${post.time}` : post.date;

  return (
    <>
      <Header initialHeadlines={getHeadlinesFromArticles(allNews)} />
      <main>
        {/* HERO */}
        <HomeHero articles={allNews} />

        {/* LAJMET E FUNDIT */}
        <section className="latest-news-section">
          <div className="latest-news-container">
            <div className="section-heading latest-news-heading">
              <span className="heading-mark" />
              <h2>Lajmet e fundit</h2>
              <Link className="latest-news-all" href="/lajme">
                Të gjitha lajmet <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="latest-news-grid">
              {latestNews.map((post) => (
                <Link href={hrefFor(post)} className="latest-news-card" key={post.id}>
                  <div className="latest-news-image">
                    <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 25vw" />
                    <span className="latest-news-category">
                      {post.category.toUpperCase()}
                    </span>
                  </div>

                  <div className="latest-news-content">
                    <h3>{post.title}</h3>
                    <div className="latest-news-date">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="8" r="6.2" />
                        <path d="M8 4.4v3.9l2.7 1.6" />
                      </svg>
                      <span>{postDate(post)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* POLITIKË */}
        <section className="politics-section">
          <div className="politics-container">
            <div className="section-heading politics-heading">
              <span className="heading-mark" />
              <h2>Politikë</h2>
            </div>

            <div className="politics-grid">
              {politicsNews[0] && (
                <Link href={hrefFor(politicsNews[0])} className="politics-main-card">
                  <div className="politics-main-image">
                    <ArticleImage src={politicsNews[0].image} alt={politicsNews[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                    <span className="politics-category">POLITIKË</span>
                    <h3>{politicsNews[0].title}</h3>
                  </div>
                  <div className="politics-main-details">
                    {politicsNews[0].excerpt && (
                      <p className="politics-main-summary">{politicsNews[0].excerpt}</p>
                    )}
                    <div className="politics-date">{postDate(politicsNews[0])}</div>
                  </div>
                </Link>
              )}

              <div className="politics-side">
                {politicsNews.slice(1, 4).map((post) => (
                  <Link key={post.id} href={hrefFor(post)} className="politics-small-card">
                    <div className="politics-small-image">
                      <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 20vw" />
                    </div>
                    <div className="politics-small-content">
                      <div className="politics-category">POLITIKË</div>
                      <h3>{post.title}</h3>
                      <div className="politics-date">{postDate(post)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {politicsNews.length > 1 && (
              <div className="politics-developments" aria-label="Zhvillimet kryesore">
                <div className="politics-developments-label">
                  <span className="politics-developments-bolt" aria-hidden="true">ϟ</span>
                  <span>ZHVILLIMET<br />KRYESORE</span>
                </div>
                <div className="politics-developments-items">
                  {politicsNews.slice(1, 4).map((post) => (
                    <Link key={post.id} href={hrefFor(post)}>{post.title}</Link>
                  ))}
                </div>
                <Link className="politics-developments-more" href="/politike" aria-label="Shiko të gjitha lajmet politike">→</Link>
              </div>
            )}
          </div>
        </section>

        {/* KOSOVË */}
        <section className="kosovo-section">
          <div className="kosovo-container">
            <div className="section-heading kosovo-heading editorial-heading">
              <span className="heading-mark" />
              <h2>Kosovë</h2>
              <Link className="editorial-more-link" href="/lajme">Shiko më shumë <span aria-hidden="true">→</span></Link>
            </div>

            <div className="kosovo-grid">
              {kosovoNews.map((post) => (
                <Link key={post.id} href={hrefFor(post)} className="kosovo-card">
                  <div className="kosovo-image">
                    <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 25vw" />
                  </div>
                  <div className="kosovo-category">KOSOVË</div>
                  <h3>{post.title}</h3>
                  <div className="kosovo-date">{postDate(post)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* SPORT */}
        {sportsNews.length > 0 && (
          <section className="sport-section sport-home-section">
            <div className="politics-container sport-home-container">
              <div className="section-heading politics-heading sport-home-heading">
                <span className="heading-mark" />
                <h2>Sport</h2>
                <Link className="sport-home-more" href="/sport" aria-label="Shiko të gjitha lajmet sportive">Të gjitha lajmet <span aria-hidden="true">→</span></Link>
              </div>

              <div className="politics-grid sport-home-grid">
                {sportsNews[0] && (
                  <Link href={hrefFor(sportsNews[0])} className="politics-main-card sport-home-main-card">
                    <div className="politics-main-image sport-home-main-image">
                    <ArticleImage src={sportsNews[0].image} alt={sportsNews[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                      <span className="politics-category sport-home-category">SPORT</span>
                      <h3>{sportsNews[0].title}</h3>
                    </div>
                    <div className="politics-main-details sport-home-main-details">
                      {sportsNews[0].excerpt && <p className="politics-main-summary">{sportsNews[0].excerpt}</p>}
                      <div className="politics-date">{postDate(sportsNews[0])}</div>
                    </div>
                  </Link>
                )}

                <div className="politics-side sport-home-side">
                  {sportsNews.slice(1, 4).map((post) => (
                    <Link key={post.id} href={hrefFor(post)} className="politics-small-card sport-home-small-card">
                      <div className="politics-small-image sport-home-small-image">
                        <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 20vw" />
                      </div>
                      <div className="politics-small-content">
                        <div className="politics-category sport-home-category-text">SPORT</div>
                        <h3>{post.title}</h3>
                        <div className="politics-date">{postDate(post)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <Suspense fallback={null}>
          <YouTubeShortsSection />
        </Suspense>

        {/* TEKNOLOGJI */}
        <section className="technology-home-section">
            <div className="politics-container technology-home-container">
              <div className="section-heading politics-heading technology-home-heading">
                <span className="heading-mark" />
                <h2>Teknologji</h2>
                <Link className="technology-home-more" href="/teknologji" aria-label="Shiko të gjitha lajmet e teknologjisë">Të gjitha lajmet <span aria-hidden="true">→</span></Link>
              </div>

              <div className="politics-grid technology-home-grid">
                {technologyNews.length === 0 && (
                  <div className="technology-home-empty">
                    Lajmet për teknologjinë do të shfaqen këtu sapo të publikohen.
                  </div>
                )}
                {technologyNews[0] && (
                  <ArticleCardLink href={hrefFor(technologyNews[0])} className="politics-main-card technology-home-main-card">
                    <div className="politics-main-image technology-home-main-image">
                      <ArticleImage src={technologyNews[0].image} alt={technologyNews[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                      <span className="politics-category technology-home-category">TEKNOLOGJI</span>
                      <h3>{technologyNews[0].title}</h3>
                    </div>
                    <div className="politics-main-details technology-home-main-details">
                      {technologyNews[0].excerpt && <p className="politics-main-summary">{technologyNews[0].excerpt}</p>}
                      <div className="politics-date">{postDate(technologyNews[0])}</div>
                    </div>
                  </ArticleCardLink>
                )}

                <div className="politics-side technology-home-side">
                  {technologyNews.slice(1, 4).map((post) => (
                    <ArticleCardLink key={post.id} href={hrefFor(post)} className="politics-small-card technology-home-small-card">
                      <div className="politics-small-image technology-home-small-image">
                        <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 20vw" />
                      </div>
                      <div className="politics-small-content">
                        <div className="politics-category technology-home-category-text">TEKNOLOGJI</div>
                        <h3>{post.title}</h3>
                        <div className="politics-date">{postDate(post)}</div>
                      </div>
                    </ArticleCardLink>
                  ))}
                </div>
              </div>
            </div>
          </section>

        {/* BOTA */}
        <section className="world-section world-2026-section">
          <div className="world-container world-2026-container">
            <div className="section-heading world-heading editorial-heading world-2026-heading">
              <span className="heading-mark" />
              <h2>Bota</h2>
              <Link className="editorial-more-link" href="/bota">Shiko më shumë <span aria-hidden="true">→</span></Link>
            </div>

            <div className="world-2026-grid">
              {worldNews[0] && (
                <Link href={hrefFor(worldNews[0])} className="world-2026-lead">
                  <div className="world-2026-lead-photo">
                    <ArticleImage src={worldNews[0].image} alt={worldNews[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                    <div className="world-2026-overlay">
                      <span className="world-2026-category">BOTA</span>
                      <h3>{worldNews[0].title}</h3>
                      <span className="world-date">{postDate(worldNews[0])}</span>
                    </div>
                  </div>
                </Link>
              )}

              <div className="world-2026-stories" aria-label="Lajmet kryesore nga bota">
                {worldNews.slice(1, 4).map((post) => (
                  <Link key={post.id} href={hrefFor(post)} className="world-2026-story">
                    <div className="world-2026-story-photo">
                    <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 40vw, 20vw" />
                    </div>
                    <div className="world-2026-story-copy">
                      <span className="world-2026-category">BOTA</span>
                      <h3>{post.title}</h3>
                      <span className="world-date">{postDate(post)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* MAGAZINË */}
        <section className="magazine-section home-magazine-section">
          <div className="magazine-container">
            <div className="section-heading magazine-heading editorial-heading">
              <span className="heading-mark" />
              <h2>Magazinë</h2>
              <Link className="editorial-more-link" href="/magazina">Shiko më shumë <span aria-hidden="true">→</span></Link>
            </div>

            <div className="magazine-grid">
              {magazineNews[0] && (
                <ArticleCardLink href={hrefFor(magazineNews[0])} className="magazine-main-card">
                  <div className="magazine-main-image">
                    <ArticleImage src={magazineNews[0].image} alt={magazineNews[0].title} sizes="(max-width: 768px) 100vw, 55vw" />
                  </div>
                  <div className="magazine-main-copy">
                    <div className="magazine-category">MAGAZINË</div>
                    <h3>{magazineNews[0].title}</h3>
                    {magazineNews[0].excerpt && (
                      <p className="magazine-main-summary">{magazineNews[0].excerpt}</p>
                    )}
                    <div className="magazine-date">{postDate(magazineNews[0])}</div>
                  </div>
                </ArticleCardLink>
              )}

              <div className="magazine-side">
                {magazineNews.slice(1, 4).map((post) => (
                  <ArticleCardLink key={post.id} href={hrefFor(post)} className="magazine-small-card">
                    <div className="magazine-small-image">
                      <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 40vw, 20vw" />
                    </div>
                    <div className="magazine-small-content">
                      <div className="magazine-category">MAGAZINË</div>
                      <h3>{post.title}</h3>
                      <div className="magazine-date">{postDate(post)}</div>
                    </div>
                  </ArticleCardLink>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SHËNDETI */}
        {healthNews.length > 0 && (
          <section className="health-home-section">
            <div className="politics-container health-home-container">
              <div className="section-heading politics-heading health-home-heading">
                <span className="heading-mark" />
                <h2>Shëndeti</h2>
                <Link className="health-home-more" href="/shendeti" aria-label="Shiko të gjitha lajmet për shëndetin">Të gjitha lajmet <span aria-hidden="true">→</span></Link>
              </div>

              <div className="politics-grid health-home-grid">
                {healthNews[0] && (
                  <Link href={hrefFor(healthNews[0])} className="politics-main-card health-home-main-card">
                    <div className="politics-main-image health-home-main-image">
                      <ArticleImage src={healthNews[0].image} alt={healthNews[0].title} sizes="(max-width: 768px) 100vw, 60vw" />
                      <span className="politics-category health-home-category">SHËNDETI</span>
                      <h3>{healthNews[0].title}</h3>
                    </div>
                    <div className="politics-main-details health-home-main-details">
                      {healthNews[0].excerpt && <p className="politics-main-summary">{healthNews[0].excerpt}</p>}
                      <div className="politics-date">{postDate(healthNews[0])}</div>
                    </div>
                  </Link>
                )}

                <div className="politics-side health-home-side">
                  {healthNews.slice(1, 4).map((post) => (
                    <Link key={post.id} href={hrefFor(post)} className="politics-small-card health-home-small-card">
                      <div className="politics-small-image health-home-small-image">
                        <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 50vw, 20vw" />
                      </div>
                      <div className="politics-small-content health-home-small-content">
                        <div className="politics-category health-home-category-text">SHËNDETI</div>
                        <h3>{post.title}</h3>
                        <div className="politics-date">{postDate(post)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

      </main>
      <Footer />
    </>
  );
}
