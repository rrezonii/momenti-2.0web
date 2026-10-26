import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Rreth nesh",
  description: "Mësoni më shumë për Momenti.info dhe përmbajtjen që publikojmë.",
  alternates: { canonical: "https://momenti.info/sq/rreth-nesh" },
};

export default function AboutPage() {
  return (
    <InfoPage
      title="Rreth nesh"
      intro="Momenti.info është portal informativ që sjell zhvillimet e fundit nga Kosova, rajoni dhe bota."
      sections={[
        {
          title: "Çfarë publikojmë",
          paragraphs: [
            "Në Momenti.info publikojmë lajme dhe informacione në kategoritë Kosovë, politikë, botë dhe magazinë. Synojmë t’i paraqesim zhvillimet në mënyrë të qartë, të kuptueshme dhe në kohë.",
            "Përmbajtja mund të përfshijë raportime, deklarata, materiale të dërguara nga burime dhe përmbajtje të ripublikuar me atribuimin përkatës. Burimi shënohet kur është i disponueshëm dhe i zbatueshëm.",
          ],
        },
        {
          title: "Përgjegjësia editoriale",
          paragraphs: [
            "Ekipi i Momenti.info synon të kontrollojë informacionin para publikimit dhe të përditësojë artikujt kur paraqiten të dhëna të reja. Nëse vëreni pasaktësi ose çështje lidhur me të drejtat e përmbajtjes, na shkruani te info@momenti.info.",
          ],
        },
        {
          title: "Na kontaktoni",
          paragraphs: [
            "Për pyetje, sugjerime, bashkëpunime ose kërkesa për korrigjim, vizitoni faqen Kontakt ose shkruani në info@momenti.info.",
          ],
        },
      ]}
    />
  );
}
