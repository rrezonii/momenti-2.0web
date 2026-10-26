"use client";

import { useEffect, useRef, useState } from "react";

export default function DeferredPromoVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Keep the large sponsor video off the critical mobile load path.
        // It still autoplays after the user reaches the banner, once the
        // initial page rendering has had time to finish.
        startTimerRef.current = setTimeout(() => setShouldLoad(true), 10_000);
      },
      { rootMargin: "0px" }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`home-promo-video-container${hasStarted ? " is-playing" : ""}`}
      aria-label="Sponsor AIR TICKETA"
    >
      {!hasStarted && (
        <div className="home-promo-video-placeholder" aria-hidden="true">
          <span>FLUTURO ME</span>
          <strong>airtiketa.com</strong>
        </div>
      )}
      <video
        className="home-promo-video"
        src={shouldLoad ? "/videos/air-ticketa.mp4" : undefined}
        autoPlay={shouldLoad}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setHasStarted(true)}
        aria-label="Video sponsor AIR TICKETA"
      />
    </div>
  );
}
