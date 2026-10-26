import type { Metadata } from "next";
import EnglishHome from "@/components/EnglishHome";

export const metadata: Metadata = {
  title: "Latest news from Kosovo and the world",
  description: "The latest news from Kosovo, the region and the world, in English.",
  alternates: {
    canonical: "https://momenti.info/en",
    languages: { sq: "https://momenti.info/sq", en: "https://momenti.info/en" },
  },
};

export const revalidate = 60;

export default function EnglishHomePage() {
  return <EnglishHome />;
}
