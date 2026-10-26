import Link from "next/link";
import Image from "next/image";
import SocialLinks from "@/components/SocialLinks";

type Locale = "sq" | "en";

const albanianLinks = [
  { label: "Ballina", href: "/sq" },
  { label: "Lajme", href: "/sq/lajme" },
  { label: "Politikë", href: "/sq/politike" },
  { label: "Bota", href: "/sq/bota" },
  { label: "Sport", href: "/sq/sport" },
  { label: "Teknologji", href: "/sq/teknologji" },
  { label: "Shëndeti", href: "/sq/shendeti" },
  { label: "Magazinë", href: "/sq/magazina" },
  { label: "Rreth nesh", href: "/sq/rreth-nesh" },
  { label: "Kontakt", href: "/sq/kontakt" },
  { label: "Politika editoriale", href: "/sq/politika-editoriale" },
  { label: "English edition", href: "/en" },
];

const englishLinks = [
  { label: "Home", href: "/en" },
  { label: "News", href: "/en/news" },
  { label: "Politics", href: "/en/politics" },
  { label: "World", href: "/en/world" },
  { label: "Sport", href: "/en/sport" },
  { label: "Technology", href: "/en/technology" },
  { label: "Health", href: "/en/health" },
  { label: "Magazine", href: "/en/magazine" },
  { label: "Albanian edition", href: "/sq" },
];

export default function Footer({ locale = "sq" }: { locale?: Locale }) {
  const english = locale === "en";
  const links = english ? englishLinks : albanianLinks;
  const categoryLinks = links.slice(1, english ? 8 : 8);
  // Categories are listed in their own column, so "Navigim" keeps only Home + the info pages.
  const navLinks = [links[0], ...links.slice(8)];

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-container">
          <div className="footer-brand">
            <Link className="footer-logo" href={english ? "/en" : "/sq"} aria-label="Momenti">
              <Image src="/logo.png" alt="Momenti" width={1080} height={280} sizes="230px" />
            </Link>
            <p>
              {english
                ? "Momenti is an independent news outlet covering Kosovo, the region and the world."
                : "Momenti është portal informativ që sjell lajmet më të fundit nga Kosova dhe bota."}
            </p>
            <SocialLinks className="footer-socials" />
          </div>

          <div className="footer-column">
            <h3>{english ? "Navigation" : "Navigim"}</h3>
            <ul>
              {navLinks.map((link) => (
                <li key={link.label}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h3>{english ? "Categories" : "Kategoritë"}</h3>
            <ul>
              {categoryLinks.map((link) => (
                <li key={link.label}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="footer-column footer-contact">
            <h3>{english ? "Contact" : "Kontakt"}</h3>
            <p>
              {english
                ? "For information, partnerships and advertising:"
                : "Për informacione, bashkëpunime dhe reklama:"}
            </p>
            <a href="mailto:info@momenti.info">info@momenti.info</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <p>
            {english
              ? "© 2026 Momenti. All rights reserved."
              : "© 2026 Momenti. Të gjitha të drejtat e rezervuara."}
          </p>
          <div className="footer-bottom-links">
            {english ? (
              <Link href="/sq/politika-e-privatesise">Privacy policy (Albanian)</Link>
            ) : (
              <>
                <Link href="/sq/politika-e-privatesise">Politika e privatësisë</Link>
                <Link href="/sq/kushtet-e-perdorimit">Kushtet e përdorimit</Link>
              </>
            )}
            <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">
              {english ? "IP geolocation by DB-IP" : "Gjeolokacioni IP nga DB-IP"}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
