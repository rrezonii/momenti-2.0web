import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Politika editoriale dhe korrigjimet",
  description: "Parimet editoriale dhe mënyra e raportimit të korrigjimeve te Momenti.info.",
  alternates: { canonical: "https://momenti.info/sq/politika-editoriale" },
};

export default function EditorialPolicyPage() {
  return (
    <InfoPage
      title="Politika editoriale dhe korrigjimet"
      intro="Parimet që udhëheqin përzgjedhjen, përgatitjen dhe përditësimin e përmbajtjes në Momenti.info."
      sections={[
        {
          title: "Saktësia dhe burimet",
          paragraphs: [
            "Synojmë të verifikojmë faktet dhe t’i atribuojmë informacionet burimeve të tyre kur kjo është e mundur dhe e përshtatshme. Deklaratat, pretendimet dhe informacionet e raportuara nga palë të treta duhet të paraqiten në kontekst dhe të mos paraqiten si fakte të konfirmuara pa bazë.",
            "Kur një lajm zhvillohet, artikulli mund të përditësohet për të pasqyruar informacionet e reja. Përditësimet materiale bëhen në mënyrë që lexuesi të kuptojë se përmbajtja është ndryshuar.",
          ],
        },
        {
          title: "Fotografitë dhe materialet e palëve të treta",
          paragraphs: [
            "Përdorimi i fotografive dhe materialeve vizuale duhet të respektojë të drejtat e autorit dhe kushtet e licencës. Burimi ose autori shënohet kur kërkohet ose kur informacioni është i disponueshëm. Kërkesat për atribuim, korrigjim ose heqje mund të dërgohen në info@momenti.info.",
          ],
        },
        {
          title: "Korrigjimet",
          paragraphs: [
            "Nëse gjeni një gabim faktik, na dërgoni lidhjen e artikullit, pjesën që duhet kontrolluar dhe burimin ose shpjegimin përkatës në info@momenti.info. Redaksia e shqyrton kërkesën dhe, kur konfirmohet pasaktësia, e korrigjon përmbajtjen. Për gabime të rëndësishme mund të shtohet shënim sqarues në artikull.",
          ],
        },
        {
          title: "Përmbajtja e sponsorizuar",
          paragraphs: [
            "Materialet e publikuara në kuadër të bashkëpunimeve komerciale duhet të dallohen nga raportimi editorial kur paraqiten si përmbajtje e sponsorizuar ose reklamë.",
          ],
        },
      ]}
    />
  );
}
