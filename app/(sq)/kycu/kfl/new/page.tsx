import { redirect } from "next/navigation";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import KflEditorLoader from "@/components/kfl/KflEditorLoader";
import type { Article } from "@/lib/types";

// "+": a blank KFL editor — no article, no title, no photo. Badge, logo and the other
// design elements stay, so a photo-news can be built from scratch.
export default async function KflBlankEditorPage({ searchParams }: { searchParams: Promise<{ brand?: string; draft?: string }> }) {
  if (!(await isKflAuthenticated())) redirect("/kycu");
  const query = await searchParams;
  const now = new Date();
  const article: Article = {
    id: 0,
    title: "",
    slug: "new",
    category: "Lajme",
    date: now.toISOString().slice(0, 10),
    publishedAt: now.toISOString(),
    image: "",
  };
  return <KflEditorLoader article={article} brand={query.brand === "ballina" ? "ballina" : "momenti"} draftId={query.draft} />;
}
