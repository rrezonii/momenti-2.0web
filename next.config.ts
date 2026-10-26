import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIST_DIR || ".next",
  experimental: {
    inlineCss: true,
    webpackMemoryOptimizations: true,
    cpus: 1,
    staticGenerationMaxConcurrency: 2,
  },
  images: {
    qualities: [45, 60, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "momenti.info",
      },
      {
        protocol: "https",
        hostname: "cms.momenti.info",
      },
      {
        protocol: "https",
        hostname: "sinjali.com",
      },
      {
        protocol: "https",
        hostname: "telegrafi.com",
      },
      {
        protocol: "https",
        hostname: "www.telegrafi.com",
      },
      {
        protocol: "https",
        hostname: "www.rtklive.com",
      },
      {
        protocol: "https",
        hostname: "www.dukagjini.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "dukagjini.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
