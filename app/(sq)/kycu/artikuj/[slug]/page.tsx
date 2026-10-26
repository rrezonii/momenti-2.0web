import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import { getWordPressArticleBySlug } from "@/lib/api";
import KflWorkspaceHeader from "@/components/kfl/KflWorkspaceHeader";

export default async function KflArticleDetails({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isKflAuthenticated())) redirect("/kycu");
  const { slug } = await params;
  const article = await getWordPressArticleBySlug(slug);
  if (!article) notFound();
  return (
    <div className="kfl-workspace">
      <KflWorkspaceHeader />
      <main className="kfl-detail-main">
        <Link className="kfl-back-link" href="/kycu/artikuj">← Kthehu te artikujt</Link>
        <article className="kfl-detail-card">
          {/* Natural height: no empty band under the photo. */}
          {article.image && <img className="kfl-detail-photo" src={article.image} alt={article.title} />}
          <div className="kfl-detail-copy">
            <div className="kfl-detail-actions">
              <Link className="kfl-button kfl-button-primary kfl-create-cta" href={`/kycu/kfl/${encodeURIComponent(article.slug)}`}>Krijo FOTOLAJM</Link>
              <Link className="kfl-button kfl-button-ballina kfl-create-cta" href={`/kycu/kfl/${encodeURIComponent(article.slug)}?brand=ballina`}>KFL Ballina</Link>
            </div>
            <span className="kfl-category-pill">{article.category}</span>
            <h1>{article.title}</h1>
            <p className="kfl-detail-meta">{article.date} · {article.time}{article.author ? ` · ${article.author}` : ""}</p>
            {article.content
              // Full text from our own WordPress (same HTML the public article page shows).
              ? <div className="kfl-detail-content" dangerouslySetInnerHTML={{ __html: article.content }} />
              : <p className="kfl-detail-excerpt">{article.excerpt || "Ky artikull nuk ka tekst."}</p>}
          </div>
        </article>
      </main>
    </div>
  );
}
