import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleImage from "@/components/ArticleImage";
import ViewTracker from "@/components/ViewTracker";
import { getEnglishArticleBySlug, getEnglishArticles, getEnglishCategoryHref, getEnglishCategoryLabel } from "@/lib/english-content";
import { getWordPressArticleBySlug } from "@/lib/api";
import { getCategoryPath } from "@/lib/category";

type Props = { params: Promise<{ slug: string }> };

const expressArticleAd =
  '<figure class="article-inline-ad article-inline-ad-banner"><img src="/images/sponsors/3m-express-banner.jpg" alt="3M Express sponsor" loading="lazy" /></figure>';

const airTicketaArticleAd =
  '<div class="article-inline-ad article-inline-ad-video"><video src="/videos/air-ticketa.mp4" autoplay muted loop playsinline preload="metadata" aria-label="AIR TICKETA sponsor video"></video></div>';

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

function englishTopic(article: { terms?: string[]; category: string }) {
  const topic = article.terms?.map((term) => term.toLowerCase()).find((term) =>
    ["politics", "world", "sport", "technology", "health", "magazine"].some((slug) => term === `momenti-en-${slug}`)
  );
  if (topic) return topic.replace("momenti-en-", "");
  const byCategory: Record<string, string> = {
    "Politikë": "politics", Bota: "world", Sport: "sport", "Magazinë": "magazine",
  };
  return byCategory[article.category] ?? "news";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getEnglishArticleBySlug(slug);
  if (!article) return { title: "Article not found", robots: { index: false, follow: true } };

  const sourceSlug = slug.startsWith("en-") ? slug.slice(3) : "";
  const source = sourceSlug ? await getWordPressArticleBySlug(sourceSlug) : undefined;
  const canonicalUrl = `https://momenti.info/en/article/${article.slug}`;
  const description = article.excerpt || article.title;
  const albanianUrl = source ? `https://momenti.info/sq/${getCategoryPath(source.category)}/${source.slug}` : undefined;

  return {
    title: article.title,
    description,
    alternates: {
      canonical: canonicalUrl,
      ...(albanianUrl ? { languages: { sq: albanianUrl, en: canonicalUrl } } : {}),
    },
    openGraph: {
      title: article.title,
      description,
      url: canonicalUrl,
      siteName: "Momenti",
      type: "article",
      locale: "en_US",
      publishedTime: article.publishedAt,
      images: article.image ? [{ url: article.image, alt: article.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

export const revalidate = 60;

export default async function EnglishArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getEnglishArticleBySlug(slug);
  if (!article) notFound();

  const topic = englishTopic(article);
  const { articles: topicArticles } = await getEnglishArticles(topic, 1, 10);
  const relatedPosts = topicArticles.filter((item) => item.id !== article.id).slice(0, 3);
  const trendingPosts = topicArticles.filter((item) => item.id !== article.id).slice(0, 5);
  const categoryLabel = getEnglishCategoryLabel(topic);
  const articleUrl = `https://momenti.info/en/article/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt || article.title,
    image: [article.image],
    datePublished: article.publishedAt,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "Momenti",
      url: "https://momenti.info",
      logo: { "@type": "ImageObject", url: "https://momenti.info/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
  };

  return (
    <>
      <ViewTracker articleId={article.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Header locale="en" />
      <main className="article-main">
        <div className="article-header-container">
          <Link href={getEnglishCategoryHref(topic)} className="article-category">{categoryLabel.toUpperCase()}</Link>
          <h1 className="article-title">{article.title}</h1>
          <div className="article-meta">{article.date}{article.time ? ` · ${article.time}` : ""}</div>
        </div>

        <div className="article-layout">
          <article className="article-page">
            <div className="article-image">
              <ArticleImage
                src={article.image}
                alt={article.title}
                sizes="(max-width: 768px) 100vw, 900px"
                className="article-image-content"
              />
              <h1 className="article-image-title">{article.title}</h1>
            </div>
            <div className="article-mobile-meta">
              <div className="article-category">{categoryLabel.toUpperCase()}</div>
              <div className="article-meta">{article.date}{article.time ? ` · ${article.time}` : ""}</div>
            </div>
            <div className="article-content">
              <div dangerouslySetInnerHTML={{ __html: insertArticleAds(article.content || "") }} />
            </div>
          </article>

          <aside className="article-sidebar">
            <div className="article-sidebar-heading"><span className="heading-mark" /><h2>Trending</h2></div>
            <div className="article-trending">
              {trendingPosts.map((post, index) => (
                <Link href={`/en/article/${post.slug}`} className="article-trending-item" key={post.id}>
                  <span className="article-trending-number">{String(index + 1).padStart(2, "0")}</span><h3>{post.title}</h3>
                </Link>
              ))}
            </div>
          </aside>
        </div>

        {relatedPosts.length > 0 && (
          <section className="article-related">
            <div className="article-related-container">
              <div className="article-related-heading"><span className="heading-mark" /><h2>Read more</h2></div>
              <div className="article-related-grid">
                {relatedPosts.map((post) => (
                  <Link href={`/en/article/${post.slug}`} className="article-related-card" key={post.id}>
                    <div className="article-related-image">
                      <ArticleImage src={post.image} alt={post.title} sizes="(max-width: 768px) 45vw, 300px" />
                    </div>
                    <div className="article-category">{categoryLabel.toUpperCase()}</div><h3>{post.title}</h3>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer locale="en" />
    </>
  );
}
