"use client";

import { useEffect } from "react";

type ViewTrackerProps = {
  articleId: number;
};

export default function ViewTracker({ articleId }: ViewTrackerProps) {
  useEffect(() => {
    const storageKey = `momenti-view-${articleId}`;

    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, "1");

    fetch("/api/views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        articleId,
      }),
      keepalive: true,
    }).catch(() => {
      sessionStorage.removeItem(storageKey);
    });
  }, [articleId]);

  return null;
}