import Link from "next/link";

type Headline = {
  id: number;
  title: string;
  href: string;
  publishedAt: string;
};

function relativeTime(publishedAt: string, locale: "sq" | "en") {
  const publishedAtTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedAtTime)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - publishedAtTime) / 60_000));
  if (minutes === 0) return locale === "en" ? "now" : "tani";
  if (minutes < 60) return locale === "en" ? `${Math.max(1, minutes)} min ago` : `para ${Math.max(1, minutes)} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "en" ? `${hours} hr ago` : `para ${hours} orë`;

  const days = Math.floor(hours / 24);
  return locale === "en" ? `${days} days ago` : `para ${days} ditë`;
}

function HeadlineItems({ items, locale, duplicate = false }: { items: Headline[]; locale: "sq" | "en"; duplicate?: boolean }) {
  return (
    <div className="breaking-news-group" aria-hidden={duplicate || undefined}>
      {items.map((item) => (
        <Link className="breaking-news-item" href={item.href} key={`${duplicate ? "copy-" : ""}${item.id}`} tabIndex={duplicate ? -1 : undefined}>
          <span className="breaking-news-title">{item.title}</span>
          <span className="breaking-news-age">{relativeTime(item.publishedAt, locale)}</span>
        </Link>
      ))}
    </div>
  );
}

export default function LatestNewsTicker({ items, locale = "sq" }: { items: Headline[]; locale?: "sq" | "en" }) {
  if (items.length === 0) return null;

  return (
    <section className="breaking-news" aria-label={locale === "en" ? "Latest headlines" : "Titujt e fundit"}>
      <div className="breaking-news-label">
        <span className="breaking-news-pulse" aria-hidden="true" />
        <span className="breaking-news-label-text">{locale === "en" ? "BREAKING NEWS" : "MOMENTI I FUNDIT"}</span>
      </div>
      <div className="breaking-news-viewport">
        <div className="breaking-news-track">
          <HeadlineItems items={items} locale={locale} />
          <HeadlineItems items={items} locale={locale} duplicate />
        </div>
      </div>
    </section>
  );
}
