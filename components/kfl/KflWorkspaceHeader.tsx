"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function KflWorkspaceHeader({ brand = "momenti", switchHref }: { brand?: "momenti" | "ballina"; switchHref?: string }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const newHref = brand === "ballina" ? "/kycu/kfl/new?brand=ballina" : "/kycu/kfl/new";

  // Already in the blank editor (e.g. a "from zero" draft): a client-side link to the same
  // page would keep the current photo/text, so load a fresh blank editor instead.
  function startBlank(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!pathname.startsWith("/kycu/kfl/new")) return;
    event.preventDefault();
    window.location.assign(newHref);
  }
  async function logout() {
    await fetch("/api/kfl/logout", { method: "POST" });
    router.replace("/kycu");
    router.refresh();
  }

  return (
    <header className="kfl-topbar">
      {/* The logo opens the public site in a new tab, so unsaved KFL work stays open. */}
      <a href="https://momenti.info" target="_blank" rel="noopener" className="kfl-brand" aria-label="Hap momenti.info">
        <Image src="/logo.png" alt="Momenti" width={138} height={36} priority />
      </a>
      <div className="kfl-topbar-actions">
        <Link href={newHref} onClick={startBlank} className="kfl-button kfl-button-secondary kfl-drafts-nav kfl-new-nav" aria-label="Fotolajm i ri nga zero" title="Fotolajm i ri nga zero">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </Link>
        <Link href="/kycu/artikuj" className="kfl-button kfl-button-secondary kfl-drafts-nav">Artikujt</Link>
        {switchHref && <Link href={switchHref} className="kfl-button kfl-button-secondary kfl-design-switch"><span className="kfl-switch-desktop">{brand === "ballina" ? "KFL Momenti" : "KFL Ballina"}</span><span className="kfl-switch-mobile">{brand === "ballina" ? "Momenti" : "Ballina"}</span></Link>}
        <Link href="/kycu/draft" className="kfl-button kfl-button-secondary kfl-drafts-nav">Draft</Link>
        <button type="button" className="kfl-button kfl-button-quiet" onClick={logout}>Dil</button>
      </div>
    </header>
  );
}
