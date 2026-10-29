"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KflDraftSummary } from "@/lib/kfl/drafts";
import { deleteKflDraft, listKflDrafts } from "@/lib/kfl/drafts";
import KflWorkspaceHeader from "@/components/kfl/KflWorkspaceHeader";

// Days are counted in Kosovo time, the same way the server keeps drafts (today, yesterday, the day before).
const DAYS = ["Sot", "Dje", "Pardje"];
const kosovoDay = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
const formatDay = (time: number) => new Intl.DateTimeFormat("sq-AL", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(time));

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<KflDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState(0);
  const days = DAYS.map((label, index) => {
    const time = Date.now() - index * 24 * 60 * 60 * 1000;
    const key = kosovoDay(time);
    return { label, time, items: drafts.filter((draft) => kosovoDay(draft.savedAt) === key) };
  });
  const shown = days[day].items;

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
            <p>Fotolajmet e ruajtura sot, dje dhe pardje. Më të vjetrat fshihen automatikisht. Hapi për të vazhduar editimin.</p>
          </div>
          <Link className="kfl-button kfl-button-secondary" href="/kycu/artikuj">Artikujt</Link>
        </div>

        <div className="kfl-draft-days" role="tablist" aria-label="Dita">
          {days.map((item, index) => <button key={item.label} type="button" role="tab" aria-selected={day === index} className={day === index ? "is-active" : ""} onClick={() => setDay(index)}>
            {item.label} <span>{formatDay(item.time)}</span><b>{loading ? "…" : item.items.length}</b>
          </button>)}
        </div>
        {!loading && <p className="kfl-draft-count">{shown.length === 1 ? "1 fotolajm u krijua" : `${shown.length} fotolajme u krijuan`} {days[day].label.toLowerCase()}.</p>}

        {error && <div className="kfl-notice kfl-notice-error" role="alert">{error}</div>}
        {loading ? <div className="kfl-drafts-empty" role="status">Po ngarkohen Draft-et…</div>
          : shown.length === 0 ? <div className="kfl-drafts-empty">{day === 0 ? "Sot ende nuk ka fotolajme. Ruaji nga KFL dhe do t’i gjesh këtu." : `${days[day].label} nuk u ruajt asnjë fotolajm.`}</div>
            : <div className="kfl-article-grid kfl-draft-grid">
              {shown.map((draft) => {
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
                    <div className="kfl-card-meta"><strong>Draft</strong><span>{new Date(draft.savedAt).toLocaleTimeString("sq-AL", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit" })}</span></div>
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
