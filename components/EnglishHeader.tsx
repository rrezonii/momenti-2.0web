import Image from "next/image";
import Link from "next/link";

const links = [
  ["HOME", "/en"],
  ["NEWS", "/en/news"],
  ["POLITICS", "/en/politics"],
  ["WORLD", "/en/world"],
  ["SPORT", "/en/sport"],
  ["TECHNOLOGY", "/en/technology"],
  ["HEALTH", "/en/health"],
  ["MAGAZINE", "/en/magazine"],
] as const;

export default function EnglishHeader() {
  return (
    <header className="english-header">
      <div className="english-header-top">
        <Link className="english-logo" href="/en" aria-label="Momenti English home">
          <Image src="/logo.png" alt="Momenti" width={1080} height={280} priority />
        </Link>
        <Link className="english-language-switch" href="/?lang=sq" lang="sq">
          SQ
        </Link>
      </div>
      <nav className="english-navigation" aria-label="English sections">
        {links.map(([label, href]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>
    </header>
  );
}
