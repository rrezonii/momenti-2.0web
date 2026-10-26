import Link from "next/link";
import type { Article } from "@/lib/types";

export default function KflArticleCard({ article }: { article: Article }) {
  return (
    <article className="kfl-article-card">
      <Link href={`/kycu/artikuj/${encodeURIComponent(article.slug)}`} className="kfl-card-image-link" aria-label={`Hap artikullin: ${article.title}`}>
        <img className="kfl-card-image" src={article.image} alt="" loading="lazy" />
      </Link>
      <div className="kfl-card-content">
        <div className="kfl-card-meta"><span>{article.category}</span><time dateTime={article.publishedAt}>{article.date} · {article.time}</time></div>
        <h2><Link href={`/kycu/artikuj/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h2>
        <p>{article.author ? `Nga ${article.author}` : "Momenti"}</p>
        <div className="kfl-card-actions">
          <Link className="kfl-button kfl-button-secondary" href={`/kycu/artikuj/${encodeURIComponent(article.slug)}`}>Hap artikullin</Link>
          <Link className="kfl-button kfl-button-primary" href={`/kycu/kfl/${encodeURIComponent(article.slug)}`}>KFL Momenti</Link>
          <Link className="kfl-button kfl-button-ballina" href={`/kycu/kfl/${encodeURIComponent(article.slug)}?brand=ballina`}>KFL Ballina</Link>
        </div>
      </div>
    </article>
  );
}
