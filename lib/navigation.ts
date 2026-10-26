export const navigation = [
  { label: "BALLINA", href: "/" },
  { label: "LAJME", href: "/lajme" },
  { label: "POLITIKË", href: "/politike" },
  { label: "BOTA", href: "/bota" },
  { label: "SPORT", href: "/sport" },
  { label: "TEKNOLOGJI", href: "/teknologji" },
  { label: "SHËNDETI", href: "/shendeti" },
  { label: "MAGAZINA", href: "/magazina" },
  { label: "KYÇU", href: "/kycu" },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
