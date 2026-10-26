import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
