import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Politika e privatësisë",
  description: "Informacion për cookies, reklamat dhe përdorimin e të dhënave në Momenti.info.",
  alternates: { canonical: "https://momenti.info/sq/politika-e-privatesise" },
};

export default function PrivacyPolicyPage() {
  return (
    <InfoPage
      title="Politika e privatësisë"
      intro="Kjo faqe shpjegon si mund të përdoren të dhënat teknike, cookies dhe shërbimet e reklamimit gjatë vizitës në Momenti.info."
      sections={[
        {
          title: "Të dhënat teknike",
          paragraphs: [
            "Gjatë vizitës, serveri dhe shërbimet teknike mund të përpunojnë të dhëna të nevojshme për dërgimin dhe sigurinë e faqes, si adresa IP, lloji i shfletuesit, pajisja, faqet e vizituara dhe koha e kërkesës. Këto të dhëna mund të përdoren për mirëmbajtje, siguri dhe diagnostikim.",
          ],
        },
        {
          title: "Cookies, analiza dhe reklama",
          paragraphs: [
            "Faqja mund të përdorë cookies ose teknologji të ngjashme për funksionimin e saj, matjen e përdorimit dhe shfaqjen e reklamave. Momenti.info përdor kodin e Google AdSense; Google dhe partnerët e tij mund të përdorin cookies ose identifikues për të ofruar dhe matur reklama, sipas cilësimeve dhe pëlqimeve të vizitorit.",
            "Nëse Google Analytics është aktivizuar në faqen tonë, ai mund të përdorë të dhëna për të na ndihmuar të kuptojmë përdorimin e faqes. Shërbimet e palëve të treta i përpunojnë të dhënat sipas politikave të tyre.",
            "Për më shumë informacion rreth mënyrës si Google përdor të dhënat, vizitoni https://policies.google.com/technologies/partner-sites. Cilësimet e reklamave mund të menaxhohen te https://adssettings.google.com/.",
          ],
        },
        {
          title: "Zgjedhjet tuaja",
          paragraphs: [
            "Mund t’i menaxhoni ose fshini cookies përmes cilësimeve të shfletuesit. Çaktivizimi i disa cookies mund të ndikojë në funksionimin e shërbimeve. Kur kërkohet nga rregullat në fuqi, zgjedhjet për cookies dhe reklamat paraqiten përmes mekanizmit përkatës të pëlqimit.",
          ],
        },
        {
          title: "Përditësime dhe kontakt",
          paragraphs: [
            "Kjo politikë mund të përditësohet kur ndryshojnë shërbimet ose kërkesat përkatëse. Për pyetje rreth privatësisë, kontaktoni info@momenti.info.",
          ],
        },
      ]}
    />
  );
}
