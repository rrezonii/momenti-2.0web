import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // test.momenti.info must never be indexed.
  if (process.env.MOMENTI_STAGING === "1") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [
      "https://momenti.info/sitemap-index.xml",
      "https://momenti.info/news-sitemap.xml",
    ],
  };
}
