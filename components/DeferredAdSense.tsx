"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const ADSENSE_CLIENT_ID = "ca-pub-8613211439675009";

export default function DeferredAdSense() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 8_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
