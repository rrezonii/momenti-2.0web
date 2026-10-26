import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export type InfoSection = {
  title: string;
  paragraphs: string[];
  emailLink?: boolean;
};

export default function InfoPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: InfoSection[];
}) {
  return (
    <>
      <Header />
      <main className="info-page">
        <div className="info-page__container">
          <Link className="info-page__back" href="/">← Ballina</Link>
          <header className="info-page__header">
            <p className="info-page__eyebrow">MOMENTI.INFO</p>
            <h1>{title}</h1>
            <p className="info-page__intro">{intro}</p>
            <p className="info-page__updated">Përditësuar më 15 tetor 2026</p>
          </header>
          <div className="info-page__content">
            {sections.map((section) => (
              <section className="info-page__section" key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.title}-${index}`}>
                    {section.emailLink && paragraph.includes("info@momenti.info") ? (
                      <>
                        {paragraph.split("info@momenti.info")[0]}
                        <a href="mailto:info@momenti.info">info@momenti.info</a>
                        {paragraph.split("info@momenti.info").slice(1).join("info@momenti.info")}
                      </>
                    ) : paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
