"use client";

import { useState } from "react";

export default function MobileSearch({ locale = "sq" }: { locale?: "sq" | "en" }) {
  const [open, setOpen] = useState(false);
  const labels = locale === "en"
    ? { close: "Close search", open: "Open search", search: "Search articles", placeholder: "Search articles..." }
    : { close: "Mbyll kërkimin", open: "Hap kërkimin", search: "Kërko artikuj", placeholder: "Kërko artikuj..." };

  return (
    <div className="mobile-search-control">
      <button
        className="mobile-search-toggle"
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls="mobile-header-search"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" strokeWidth="2.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" strokeWidth="2.6" />
            <path d="m16 16 4.5 4.5" strokeWidth="2.6" />
          </svg>
        )}
      </button>
      {open && (
        <form
          id="mobile-header-search"
          action={locale === "en" ? "/en/news" : "/sq/kerko"}
          method="get"
          role="search"
          className="header-search mobile-header-search"
        >
          <label className="sr-only" htmlFor="mobile-header-search-query">
            {labels.search}
          </label>
          <input
            id="mobile-header-search-query"
            type="search"
            name="q"
            placeholder={labels.placeholder}
            aria-label={labels.search}
            minLength={2}
            maxLength={120}
            required
            autoFocus
          />
          <button type="submit" aria-label={locale === "en" ? "Search" : "Kërko"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
