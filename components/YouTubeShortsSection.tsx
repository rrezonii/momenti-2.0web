import { getLatestYouTubeShorts, type YouTubeShort } from "@/lib/youtube";
import ArticleImage from "@/components/ArticleImage";

function publishedDate(value: string, locale: "sq" | "en") {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sq-AL", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export default async function YouTubeShortsSection({ locale = "sq" }: { locale?: "sq" | "en" } = {}) {
  const shorts: YouTubeShort[] = await getLatestYouTubeShorts(4);
  if (shorts.length === 0) return null;

  return (
    <section className="youtube-shorts-section" aria-labelledby="youtube-shorts-heading">
      <div className="youtube-shorts-container">
        <div className="youtube-shorts-heading-row">
          <div>
            <h2 id="youtube-shorts-heading">
              <span className="youtube-shorts-brand">Momenti</span>{" "}
              <span>Shorts</span>
            </h2>
          </div>
          <a
            className="youtube-shorts-all"
            href="https://www.youtube.com/@MomentiMedia/shorts"
            target="_blank"
            rel="noopener noreferrer"
          >
            {locale === "en" ? "Watch all" : "Shiko të gjitha"} <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="youtube-shorts-grid">
          {shorts.slice(0, 4).map((short, index) => (
            <a
              className="youtube-shorts-card"
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(short.videoId)}`}
              key={short.videoId}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={locale === "en" ? `Watch on YouTube: ${short.title}` : `Shiko në YouTube: ${short.title}`}
            >
              <div className="youtube-shorts-thumbnail">
                <ArticleImage src={short.thumbnail} alt="" sizes="(max-width: 768px) 45vw, 25vw" />
                <span className="youtube-shorts-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="youtube-shorts-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M8 5.8c0-.8.9-1.3 1.6-.9l10.1 6.1a1.2 1.2 0 0 1 0 2L9.6 19.1c-.7.4-1.6-.1-1.6-.9V5.8Z" /></svg>
                </span>
                <span className="youtube-shorts-badge">SHORTS</span>
              </div>
              <h3>{short.title}</h3>
              <div className="youtube-shorts-date">{publishedDate(short.publishedAt, locale)}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
