"use client";

import dynamic from "next/dynamic";
import type { Article } from "@/lib/types";

const KflCanvasEditor = dynamic(() => import("./KflCanvasEditor"), {
  ssr: false,
  loading: () => <div className="kfl-editor-loading" role="status">Po hapet editori…</div>,
});

export default function KflEditorLoader({ article, brand = "momenti", draftId }: { article: Article; brand?: "momenti" | "ballina"; draftId?: string }) {
  return <KflCanvasEditor article={article} brand={brand} draftId={draftId} />;
}
