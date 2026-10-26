import Image from "next/image";
import Header from "@/components/Header";

const trendingPosts = [
  "Hoti pas deklaratave të Kurtit: Si mund të thirret në marrëveshje kur Bekim Sejdiu u tërhoq",
  "ETC prej fillimit – 21 vite një histori bashkë!",
  "Forcimi i luftës kundër krimit të organizuar, ambasada amerikane në Tiranë njofton për takimin",
  "Due takon Gjuriqin e Petkoviqin në Beograd",
  "Gjuha shqipe dhe lënda voluminoze si shqetësime",
];

export default function Article() {
  return (
    <>
      <Header />

      <main>
        <div className="article-layout">
          <article className="article-page">
            <div className="article-container">
              <div className="article-category">
                LAJME
              </div>

              <h1 className="article-title">
                Shiste diploma për 300 euro, dyshohet se përfitonte nga shitja e dokumenteve
              </h1>

              <div className="article-meta">
                30 Shtator 2026 • 14:35
              </div>

              <div className="article-image">
                <Image
                  src="/images/momenti-default.jpg"
                  alt="Shiste diploma për 300 euro"
                  fill
                  priority
                  className="article-image-content"
                />
              </div>

              <div className="article-content">
                <p>
                  Ky është paragrafi i parë i artikullit. Për momentin po
                  përdorim tekst demonstrues për të parë se si do të duket
                  përmbajtja.
                </p>

                <p>
                  Më vonë, ky tekst do të vijë automatikisht nga WordPress
                  dhe struktura e faqes do të mbetet e njëjtë.
                </p>

                <div className="article-inline-image">
                  <Image
                    src="/images/featured-1.jpg"
                    alt="Foto nga lajmi"
                    fill
                    className="article-inline-image-content"
                  />
                </div>

                <p>
                  Ky është një paragraf pas fotografisë. Artikulli mund të
                  vazhdojë me tekst normal pas çdo fotografie ose materiali
                  tjetër.
                </p>

                <div className="article-video">
                  <div className="article-video-placeholder">
                    <span className="article-video-play">
                      ▶
                    </span>

                    <span>
                      Video e artikullit
                    </span>
                  </div>
                </div>

                <p>
                  Këtu vazhdon pjesa tjetër e artikullit. Më vonë videoja
                  mund të vijë automatikisht nga YouTube ose nga burimi i
                  videos.
                </p>
              </div>
            </div>
          </article>

          <aside className="article-sidebar">
            <div className="section-heading">
              <span className="heading-mark" />
              <h2>Në trend</h2>
            </div>

            <div className="article-trending">
              {trendingPosts.map((post, index) => (
                <article
                  className="article-trending-item"
                  key={post}
                >
                  <span className="article-trending-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3>{post}</h3>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
