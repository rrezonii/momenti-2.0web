"use client";

import { useEffect, useState } from "react";

type DesktopYouTubeEmbedProps = {
  videoId: string;
  title: string;
  thumbnail: string;
};

export default function DesktopYouTubeEmbed({
  videoId,
  title,
  thumbnail,
}: DesktopYouTubeEmbedProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 769px)");
    const updateViewport = () => setIsDesktop(desktopQuery.matches);

    updateViewport();
    desktopQuery.addEventListener("change", updateViewport);
    return () => desktopQuery.removeEventListener("change", updateViewport);
  }, []);

  if (!isDesktop) return null;

  return (
    <div className="youtube-short-frame" style={{ backgroundImage: `url("${thumbnail}")` }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&playsinline=1&rel=0&controls=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}
