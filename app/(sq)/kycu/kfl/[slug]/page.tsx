import { notFound, redirect } from "next/navigation";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import { getWordPressArticleBySlug } from "@/lib/api";
import KflEditorLoader from "@/components/kfl/KflEditorLoader";

export default async function KflEditorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ brand?: string; draft?: string }> }) {
  if (!(await isKflAuthenticated())) redirect("/kycu");
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const article = await getWordPressArticleBySlug(slug);
  if (!article) notFound();
  return <KflEditorLoader article={article} brand={query.brand === "ballina" ? "ballina" : "momenti"} draftId={query.draft} />;
}
