"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavigationItemActive, navigation } from "@/lib/navigation";

type Locale = "sq" | "en";

const englishNavigation = [
  { label: "HOME", href: "/en" },
  { label: "NEWS", href: "/en/news" },
  { label: "POLITICS", href: "/en/politics" },
  { label: "WORLD", href: "/en/world" },
  { label: "SPORT", href: "/en/sport" },
  { label: "TECHNOLOGY", href: "/en/technology" },
  { label: "HEALTH", href: "/en/health" },
  { label: "MAGAZINE", href: "/en/magazine" },
] as const;

const LoginIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-login-icon">
    <path d="M12 3.5v8" />
    <path d="M7.05 6.6a7 7 0 1 0 9.9 0" />
  </svg>
);

export default function DesktopNavigation({ locale = "sq" }: { locale?: Locale }) {
  const pathname = usePathname() || "/";
  const items = locale === "en" ? englishNavigation : navigation;
  const activePath = pathname === "/sq" ? "/" : pathname.startsWith("/sq/") ? pathname.slice(3) : pathname;

  return (
    <div className="nav-links">
      {items.map((item) => {
        const href = locale === "en" ? item.href : item.href === "/" ? "/sq" : `/sq${item.href}`;
        const active = isNavigationItemActive(activePath, item.href);
        return (
          <Link
            key={item.label}
            href={href}
            className={`${active ? "active" : ""}${item.href === "/kycu" ? " nav-login" : ""}`.trim() || undefined}
            aria-current={active ? "page" : undefined}
            aria-label={item.href === "/kycu" ? "Kyçu" : undefined}
            title={item.href === "/kycu" ? "Kyçu" : undefined}
          >
            {item.href === "/kycu" ? <LoginIcon /> : item.label}
          </Link>
        );
      })}
    </div>
  );
}
