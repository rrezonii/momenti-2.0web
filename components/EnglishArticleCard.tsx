import Link from "next/link";
import type { Article } from "@/lib/types";
import { getEnglishCategoryLabel } from "@/lib/english-content";

export default function EnglishArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const marker = article.terms?.find((term) => term.startsWith("momenti-en-"));
  const topic = marker?.replace("momenti-en-", "") ?? "news";
  return (
    <article className={`english-story-card${featured ? " is-featured" : ""}`}>
      <Link href={`/en/article/${article.slug}`} className="english-story-link">
        <div className="english-story-image">
          {/* Keep source image URLs intact; the CMS may use many publisher hosts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt={article.title} loading={featured ? "eager" : "lazy"} />
          <span>{getEnglishCategoryLabel(topic).toUpperCase()}</span>
        </div>
        <div className="english-story-copy">
          <h2>{article.title}</h2>
          {featured && article.excerpt && <p>{article.excerpt}</p>}
          <time dateTime={article.publishedAt}>{article.date}{article.time ? ` · ${article.time}` : ""}</time>
        </div>
      </Link>
    </article>
  );
}
