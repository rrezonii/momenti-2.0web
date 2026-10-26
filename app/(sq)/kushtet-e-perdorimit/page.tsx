import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Kushtet e përdorimit",
  description: "Kushtet e përdorimit të faqes Momenti.info.",
  alternates: { canonical: "https://momenti.info/sq/kushtet-e-perdorimit" },
};

export default function TermsPage() {
  return (
    <InfoPage
      title="Kushtet e përdorimit"
      intro="Duke përdorur Momenti.info, pranoni kushtet e përgjithshme të mëposhtme."
      sections={[
        {
          title: "Përdorimi i faqes",
          paragraphs: [
            "Përmbajtja publikohet për informim të përgjithshëm. Ne synojmë ta mbajmë informacionin të saktë dhe të përditësuar, por nuk garantojmë se çdo material është i plotë ose se nuk do të ndryshojë pas publikimit.",
            "Përdoruesit duhet ta përdorin faqen në mënyrë të ligjshme dhe të mos pengojnë funksionimin, sigurinë ose qasjen e vizitorëve të tjerë.",
          ],
        },
        {
          title: "Të drejtat e përmbajtjes",
          paragraphs: [
            "Tekstet, logot dhe elementet e krijuara nga Momenti.info mbrohen nga të drejtat përkatëse. Nuk lejohet riprodhimi ose përdorimi komercial i tyre pa autorizim, përveç rasteve të lejuara me ligj.",
            "Materialet e palëve të treta mbeten pronë e autorëve ose mbajtësve përkatës të të drejtave dhe mund të kenë kushte të veçanta përdorimi.",
          ],
        },
        {
          title: "Lidhjet dhe shërbimet e palëve të treta",
          paragraphs: [
            "Faqja mund të përmbajë lidhje ose shërbime të palëve të treta. Momenti.info nuk kontrollon përmbajtjen dhe politikat e faqeve të jashtme; përdorimi i tyre bëhet sipas kushteve të atyre shërbimeve.",
          ],
        },
        {
          title: "Ndryshimet dhe kontaktimi",
          paragraphs: [
            "Këto kushte mund të përditësohen. Versioni aktual publikohet në këtë faqe. Për pyetje rreth përdorimit të faqes, kontaktoni info@momenti.info.",
          ],
        },
      ]}
    />
  );
}
