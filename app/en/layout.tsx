import SiteRoot, { ADSENSE_CLIENT_ID, metadata as sharedMetadata } from "@/components/SiteRoot";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...sharedMetadata,
  title: {
    default: "English news from Kosovo and the world",
    template: "%s | Momenti",
  },
  description: "The latest news from Kosovo, the region and the world, in English.",
  alternates: {
    canonical: "https://momenti.info/en",
    languages: { sq: "https://momenti.info/sq", en: "https://momenti.info/en" },
  },
  openGraph: {
    siteName: "Momenti",
    locale: "en_US",
    type: "website",
  },
  // AdSense site verification reads the server HTML of the English pages.
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
};

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <SiteRoot locale="en"><div className="english-site">{children}</div></SiteRoot>;
}
