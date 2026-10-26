import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontaktoni redaksinë e Momenti.info.",
  alternates: { canonical: "https://momenti.info/sq/kontakt" },
};

export default function ContactPage() {
  return (
    <InfoPage
      title="Kontakt"
      intro="Për komunikim me Momenti.info, përdorni adresën zyrtare të emailit më poshtë."
      sections={[
        {
          title: "Redaksia dhe bashkëpunimet",
          emailLink: true,
          paragraphs: [
            "Për informacione, sugjerime, bashkëpunime dhe reklama, na shkruani në info@momenti.info.",
          ],
        },
        {
          title: "Korrigjime dhe të drejta të përmbajtjes",
          emailLink: true,
          paragraphs: [
            "Për të raportuar një pasaktësi ose për të paraqitur kërkesë lidhur me një tekst apo fotografi, dërgoni lidhjen e artikullit dhe një shpjegim të shkurtër në info@momenti.info. Për kërkesat për të drejta, përfshini informacion që ndihmon në verifikimin e pronësisë ose autorizimit.",
          ],
        },
      ]}
    />
  );
}
