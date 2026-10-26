import type { Metadata } from "next";
import "@fontsource/lato/900.css";
import "@/app/globals.css";
import "@/app/theme-burgundy.css"; // burgundy test theme — remove this line to switch it off
import { GoogleAnalytics } from "@/components/google-analytics";


// AdSense does not support Albanian, so ad code is placed only on English (/en) pages.
export const ADSENSE_CLIENT_ID = "ca-pub-8613211439675009";

export const metadata: Metadata = {
  metadataBase: new URL("https://momenti.info"),

  title: {
    default: "Momenti – Lajme nga Kosova dhe Bota",
    template: "%s | Momenti",
  },

  description:
    "Momenti është portal informativ që sjell lajmet më të fundit nga Kosova, rajoni dhe bota.",

  keywords: [
    "Momenti",
    "lajme",
    "lajme Kosovë",
    "Kosovë",
    "politikë",
    "bota",
    "showbiz",
    "lajme të fundit",
  ],

  authors: [{ name: "Momenti" }],
  creator: "Momenti",
  publisher: "Momenti",

  alternates: {
    canonical: "https://momenti.info/sq",
  },

  openGraph: {
    type: "website",
    locale: "sq_AL",
    url: "https://momenti.info/sq",
    siteName: "Momenti",
    title: "Momenti – Lajme nga Kosova dhe Bota",
    description:
      "Lajmet më të fundit nga Kosova, rajoni dhe bota.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Momenti – Lajme nga Kosova dhe Bota",
    description:
      "Lajmet më të fundit nga Kosova, rajoni dhe bota.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: "Momenti",
  url: "https://momenti.info",
  logo: {
    "@type": "ImageObject",
    url: "https://momenti.info/logo.png",
  },
  description:
    "Momenti është portal informativ që sjell lajmet më të fundit nga Kosova, rajoni dhe bota.",
};

export default function SiteRoot({
  children,
  locale,
}: { children: React.ReactNode; locale: "sq" | "en" }) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_ID ?? "";

  return (
    <html
      lang={locale}
      className="h-full antialiased"
    >
      {locale === "en" && process.env.MOMENTI_STAGING !== "1" && (
        <head>
          {/* Server-rendered so AdSense's crawler finds it; async keeps it non-blocking. */}
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        </head>
      )}
      {/* Browser extensions (translators, ad blockers…) add attributes to <body> before React
          loads; suppressHydrationWarning only ignores those attribute differences on this tag. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Mobile browser bar / overscroll colour = header colour (burgundy theme). React hoists it into <head>. */}
        <meta name="theme-color" content="#340d13" />
        <GoogleAnalytics measurementId={gaMeasurementId} />
        {children}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </body>
    </html>
  );
}
