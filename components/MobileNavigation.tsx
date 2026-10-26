"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNavigationItemActive, navigation } from "@/lib/navigation";

export default function MobileNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() || "/";
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) return;

    // Warm category routes while the menu is open, before a category is selected.
    for (const item of navigation) {
      if (item.href !== "/kycu") router.prefetch(item.href);
    }
  }, [menuOpen, router]);

  return (
    <>
      <button
        className={`mobile-menu-button ${menuOpen ? "is-open" : ""}`}
        type="button"
        aria-label={menuOpen ? "Mbyll menunë" : "Hap menunë"}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        id="mobile-navigation"
        className={`mobile-navigation ${menuOpen ? "is-open" : ""}`}
      >
        {navigation.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`${isNavigationItemActive(pathname, item.href) ? "active" : ""}${item.href === "/kycu" ? " nav-login" : ""}`.trim() || undefined}
            aria-current={pathname === item.href ? "page" : undefined}
            aria-label={item.href === "/kycu" ? "Kyçu" : undefined}
            title={item.href === "/kycu" ? "Kyçu" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {item.href === "/kycu"
              ? <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-login-icon"><path d="M12 3.5v8" /><path d="M7.05 6.6a7 7 0 1 0 9.9 0" /></svg>
              : item.label}
          </Link>
        ))}
        <form action="/kerko" method="get" role="search" className="header-search header-search-mobile">
          <label className="sr-only" htmlFor="article-search-header-search-mobile">
            Kërko artikuj
          </label>
          <input
            id="article-search-header-search-mobile"
            type="search"
            name="q"
            placeholder="Kërko artikuj..."
            aria-label="Kërko artikuj"
            minLength={2}
            maxLength={120}
            required
          />
          <button type="submit" aria-label="Kërko">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
