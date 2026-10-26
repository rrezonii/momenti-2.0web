"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KflDraftSummary } from "@/lib/kfl/drafts";
import { deleteKflDraft, listKflDrafts } from "@/lib/kfl/drafts";
import KflWorkspaceHeader from "@/components/kfl/KflWorkspaceHeader";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<KflDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listKflDrafts().then((items) => {
      if (!active) return;
      setDrafts(items);
    }).catch(() => {
      if (active) { setDrafts([]); setError("Draft-et nuk mundën të ngarkohen nga serveri."); }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function removeDraft(id: string) {
    try {
      await deleteKflDraft(id);
      setDrafts((items) => items.filter((item) => item.id !== id));
    } catch {
      setError("Draft-i nuk mundi të fshihet nga serveri.");
    }
  }

  return (
    <div className="kfl-workspace kfl-root">
      <KflWorkspaceHeader />
      <main className="kfl-dashboard-main kfl-drafts-main">
        <div className="kfl-page-heading">
          <div>
            <span className="kfl-eyebrow">HAPËSIRA E REDAKSISË</span>
            <h1>Draft</h1>
            <p>60 fotolajmet e fundit që i ke ruajtur nga KFL. Hapi për të vazhduar editimin; ndërrimi i dizajnit nuk i ndryshon tekstet dhe fotot.</p>
          </div>
          <Link className="kfl-button kfl-button-secondary" href="/kycu/artikuj">Artikujt</Link>
        </div>

        {error && <div className="kfl-notice kfl-notice-error" role="alert">{error}</div>}
        {loading ? <div className="kfl-drafts-empty" role="status">Po ngarkohen Draft-et…</div>
          : drafts.length === 0 ? <div className="kfl-drafts-empty">Ende nuk ka Draft-e. Ruaji fotolajmet nga KFL dhe do t’i gjesh këtu.</div>
            : <div className="kfl-article-grid kfl-draft-grid">
              {drafts.map((draft) => {
                const href = `/kycu/kfl/${encodeURIComponent(draft.article.slug)}?draft=${encodeURIComponent(draft.id)}&brand=${draft.brand}`;
                return <article className="kfl-article-card kfl-draft-card" key={draft.id}>
                  <div className={`kfl-draft-preview${draft.brand === "ballina" ? " is-ballina" : ""}`} aria-label={`Preview: ${draft.title || draft.article.title || "Fotolajm pa titull"}`}>
                    {draft.previewImageUrl ? <img src={draft.previewImageUrl} alt="" loading="lazy" /> : <>
                      <img src={draft.mainImageUrl} alt="" loading="lazy" />
                      <div className="kfl-draft-preview-shade" />
                      <div className="kfl-draft-preview-copy">
                        {draft.badgeVisible && draft.badge && <span className="kfl-draft-preview-badge">{draft.badge}</span>}
                        <strong className="kfl-draft-preview-title">{draft.title || draft.article.title || "Fotolajm pa titull"}</strong>
                      </div>
                    </>}
                  </div>
                  <div className="kfl-card-content">
                    <div className="kfl-card-meta"><strong>Draft</strong><span>{new Date(draft.savedAt).toLocaleString("sq-AL", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                    <div className="kfl-card-actions">
                      <Link className="kfl-button kfl-button-primary" href={href}>Vazhdo editimin</Link>
                      <button className="kfl-button kfl-button-secondary" type="button" onClick={() => void removeDraft(draft.id)}>Fshije</button>
                    </div>
                  </div>
                </article>;
              })}
            </div>}
      </main>
    </div>
  );
}
