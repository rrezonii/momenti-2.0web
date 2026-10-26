import { redirect } from "next/navigation";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import { kflHiddenReason } from "@/lib/kfl/articleFilter";
import { getKflHiddenCategories, getWordPressArticlesPage } from "@/lib/api";
import type { Article } from "@/lib/types";
import KflWorkspaceHeader from "@/components/kfl/KflWorkspaceHeader";
import KflArticleCard from "@/components/kfl/KflArticleCard";
import KflPagination from "@/components/kfl/KflPagination";

export const metadata = { title: "Artikujt | KFL Momenti" };
const KFL_ARTICLE_LIMIT = 200;
const KFL_PAGE_SIZE = 20;
const KFL_MAX_PAGES = Math.ceil(KFL_ARTICLE_LIMIT / KFL_PAGE_SIZE);
const KFL_SCAN_PAGES = 3; // 3 × 100 newest posts, so ~200 remain after hiding sport/ads

export default async function KflArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await isKflAuthenticated())) redirect("/kycu");
  const query = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const page = Math.min(requestedPage, KFL_MAX_PAGES);
  if (requestedPage !== page) redirect(`/kycu/artikuj?page=${page}`);

  let visible: Article[] | null = null;
  let hiddenSport = 0;
  let hiddenAds = 0;
  let error = "";
  try {
    // Real Sport/advertising categories (if WordPress ever gets them) are excluded at the source;
    // the rest are detected by keywords (see lib/kfl/articleFilter.ts).
    const hiddenCategories = await getKflHiddenCategories().catch(() => []);
    const excludeIds = hiddenCategories.map((category) => category.id);
    const scanned: Article[] = [];
    for (let scanPage = 1; scanPage <= KFL_SCAN_PAGES; scanPage += 1) {
      const chunk = await getWordPressArticlesPage(scanPage, 100, KFL_SCAN_PAGES * 100, excludeIds);
      scanned.push(...chunk.articles);
      if (scanPage >= chunk.totalPages || chunk.articles.length === 0) break;
    }
    const kept: Article[] = [];
    const seen = new Set<number>();
    for (const article of scanned) {
      if (seen.has(article.id)) continue;
      seen.add(article.id);
      const reason = kflHiddenReason(article);
      if (reason === "sport") hiddenSport += 1;
      else if (reason === "reklama") hiddenAds += 1;
      else kept.push(article);
    }
    visible = kept.slice(0, KFL_ARTICLE_LIMIT);
  } catch {
    error = "Nuk mundëm të marrim artikujt nga WordPress. Kontrollo lidhjen dhe WORDPRESS_URL.";
  }

  const totalPages = visible ? Math.max(1, Math.ceil(visible.length / KFL_PAGE_SIZE)) : 1;
  if (visible && page > totalPages) redirect(totalPages <= 1 ? "/kycu/artikuj" : `/kycu/artikuj?page=${totalPages}`);
  const articles = visible ? visible.slice((page - 1) * KFL_PAGE_SIZE, page * KFL_PAGE_SIZE) : [];
  const hiddenNote = [hiddenSport ? `${hiddenSport} sport` : "", hiddenAds ? `${hiddenAds} reklama` : ""].filter(Boolean).join(", ");

  return (
    <div className="kfl-workspace">
      <KflWorkspaceHeader />
      <main className="kfl-dashboard-main">
        <div className="kfl-page-heading">
          <div><span className="kfl-eyebrow">HAPËSIRA E REDAKSISË</span><h1>Zgjidh një artikull</h1><p>Shfaqen deri në 200 lajmet më të reja nga WordPress, pa lajmet e sportit dhe reklamat. Zgjidh një për ta parë ose krijo menjëherë fotolajmin.</p>
            {hiddenNote && <p className="kfl-hidden-categories">U fshehën nga lista: {hiddenNote}</p>}</div>
          {visible && <span className="kfl-total-count">{visible.length.toLocaleString("sq-AL")} / 200 artikuj</span>}
        </div>
        {error && <div className="kfl-notice kfl-notice-error" role="alert">{error}</div>}
        {visible && articles.length === 0 && <div className="kfl-empty-state">Nuk u gjetën artikuj në këtë faqe.</div>}
        {articles.length > 0 && <>
          <div className="kfl-article-grid">{articles.map((article) => <KflArticleCard key={article.id} article={article} />)}</div>
          <KflPagination page={page} totalPages={totalPages} />
        </>}
      </main>
    </div>
  );
}
