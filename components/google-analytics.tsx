"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type GoogleAnalyticsProps = {
  measurementId: string;
};

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const initialized = useRef(false);
  const lastPageView = useRef("");

  useEffect(() => {
    if (!measurementId || !pathname) return;

    if (!initialized.current) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () {
        // Google's command queue expects an Arguments object, not an Array.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });

      // Load asynchronously after hydration without losing short visits.
      if (!document.querySelector("script[data-google-analytics]")) {
        const analyticsScript = document.createElement("script");
        analyticsScript.async = true;
        analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        analyticsScript.dataset.googleAnalytics = measurementId;
        document.head.appendChild(analyticsScript);
      }

      initialized.current = true;
    }

    // Read the public URL: /sq is internally rewritten to unprefixed routes.
    const pagePath = `${window.location.pathname}${window.location.search}`;
    if (lastPageView.current === pagePath) return;

    window.gtag?.("event", "page_view", {
      send_to: measurementId,
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
    lastPageView.current = pagePath;
  }, [measurementId, pathname]);

  if (!measurementId) return null;
  return null;
}
