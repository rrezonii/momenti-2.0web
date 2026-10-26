import Link from "next/link";

export default function EnglishFooter() {
  return (
    <footer className="english-footer">
      <Link href="/en">Momenti</Link>
      <p>Independent news from Kosovo, the region and the world.</p>
      <nav aria-label="Footer">
        <Link href="/en/news">News</Link>
        <Link href="/en/world">World</Link>
        <Link href="/">Albanian edition</Link>
        <a href="mailto:info@momenti.info">Contact</a>
      </nav>
      <small>© 2026 Momenti. All rights reserved.</small>
    </footer>
  );
}
