import type { Metadata } from "next";
import Header from "@/components/Header";
import {
  getWordPressArticleBySlug,
  getWordPressArticles,
} from "@/lib/api";
import Footer from "@/components/Footer";
import { getCategoryPath } from "@/lib/category";
import ViewTracker from "@/components/ViewTracker";
import { getEnglishArticleBySlug } from "@/lib/english-content";

const expressArticleAd =
  '<figure class="article-inline-ad article-inline-ad-banner"><img src="/images/sponsors/3m-express-banner.jpg" alt="Sponsor 3M Express" loading="lazy" /></figure>';

const airTicketaArticleAd =
  '<div class="article-inline-ad article-inline-ad-video"><video src="/videos/air-ticketa.mp4" autoplay muted loop playsinline preload="metadata" aria-label="Video sponsor AIR TICKETA"></video></div>';

function insertArticleAds(content: string) {
  let paragraphCount = 0;
  let html = content.replace(/<\/p\s*>/gi, (closingTag) => {
    paragraphCount += 1;
    if (paragraphCount === 2) return `${closingTag}${expressArticleAd}`;
    if (paragraphCount === 4) return `${closingTag}${airTicketaArticleAd}`;
    return closingTag;
  });

  if (paragraphCount < 2) html += expressArticleAd;
  if (paragraphCount < 4) html += airTicketaArticleAd;
  return html;
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  const article = await getWordPressArticleBySlug(slug);

  if (!article) {
    return {
      title: "Artikulli nuk u gjet",
    };
  }

  const description =
    article.excerpt ||
    `Lexoni lajmin e plotë në Momenti: ${article.title}`;

  const categoryPath = getCategoryPath(article.category);
  const canonicalUrl = `https://momenti.info/sq/${categoryPath}/${article.slug}`;
  const englishArticle = await getEnglishArticleBySlug(`en-${article.slug}`);

  return {
    title: article.title,
    description,

    alternates: {
      canonical: canonicalUrl,
      ...(englishArticle
        ? { languages: { sq: canonicalUrl, en: `https://momenti.info/en/article/${englishArticle.slug}` } }
        : {}),
    },

    openGraph: {
      title: article.title,
      description,
      url: canonicalUrl,
      siteName: "Momenti",
      type: "article",
      publishedTime: article.publishedAt,
      images: article.image
        ? [
            {
              url: article.image,
              alt: article.title,
            },
          ]
        : undefined,
    },

    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await getWordPressArticleBySlug(slug);

  if (!article) {
    return (
      <>
        <Header />

        <main className="article-not-found">
          <div className="article-not-found-container">
            <div className="article-category">LAJME</div>

            <h1>Artikulli nuk u gjet</h1>

            <p>
              Artikulli që kërkoni nuk ekziston ose nuk është më i
              disponueshëm.
            </p>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  const categoryPath = getCategoryPath(article.category);

  const allArticles = await getWordPressArticles(article.category);

  const trendingPosts = allArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 5);

  const relatedPosts = allArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  const authorName = article.author?.trim();
  const authorSchema = authorName && authorName.toLocaleLowerCase("sq-AL") !== "momenti"
    ? {
        "@type": "Person",
        name: authorName,
      }
    : {
        "@type": "Organization",
        name: "Momenti",
        url: "https://momenti.info/sq",
      };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: article.title,
        description: article.excerpt || article.title,
        image: [article.image],
        datePublished: article.publishedAt,
        ...(article.modifiedAt ? { dateModified: article.modifiedAt } : {}),
        author: authorSchema,
        publisher: {
          "@type": "Organization",
          name: "Momenti",
          url: "https://momenti.info",
          logo: {
            "@type": "ImageObject",
            url: "https://momenti.info/logo.png",
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://momenti.info/sq/${categoryPath}/${article.slug}`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ballina",
            item: "https://momenti.info/sq",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: article.category,
            item: `https://momenti.info/sq/${categoryPath}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `https://momenti.info/sq/${categoryPath}/${article.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <ViewTracker articleId={article.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Header />

      <main className="article-main">
        {/* HEADER I ARTIKULLIT */}

        <div className="article-header-container">
          <div className="article-category">
            {article.category.toUpperCase()}
          </div>

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta">
            {article.date}
            {article.time ? ` • ${article.time}` : ""}
          </div>
        </div>

        {/* FOTO + SIDEBAR */}

        <div className="article-layout">
          <article className="article-page">
           <div className="article-image">
              <img
                src={article.image}
                alt={article.title}
                className="article-image-content"
              />
              <h1 className="article-image-title">{article.title}</h1>
</div>

            <div className="article-mobile-meta">
              <div className="article-category">
                {article.category.toUpperCase()}
              </div>
              <div className="article-meta">
                {article.date}
                {article.time ? ` • ${article.time}` : ""}
              </div>
            </div>

            <div className="article-content">
              <div
                dangerouslySetInnerHTML={{
                  __html: insertArticleAds(article.content || ""),
                }}
              />
            </div>
          </article>

          {/* SIDEBAR */}

          <aside className="article-sidebar">
            <div className="article-sidebar-heading">
              <span className="heading-mark" />

              <h2>Në trend</h2>
            </div>

            <div className="article-trending">
              {trendingPosts.map((post, index) => (
                <a
                  href={`/${categoryPath}/${post.slug}`}
                  className="article-trending-item"
                  key={post.id}
                >
                  <span className="article-trending-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3>{post.title}</h3>
                </a>
              ))}
            </div>
          </aside>
        </div>

        {/* LEXO EDHE */}

        <section className="article-related">
          <div className="article-related-container">
            <div className="article-related-heading">
              <span className="heading-mark" />

              <h2>Lexo edhe</h2>
            </div>

            <div className="article-related-grid">
              {relatedPosts.map((post) => (
                <a
                  href={`/${categoryPath}/${post.slug}`}
                  className="article-related-card"
                  key={post.id}
                >
                  <div className="article-related-image">
                    <img src={post.image} alt={post.title} />
                  </div>

                  <div className="article-category">
                    {post.category.toUpperCase()}
                  </div>

                  <h3>{post.title}</h3>
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
