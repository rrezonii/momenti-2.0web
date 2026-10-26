"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type ArticleCardLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
};

function scrollToArticleStart() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export default function ArticleCardLink({
  href,
  className,
  children,
}: ArticleCardLinkProps) {
  return (
    <Link href={href} className={className} scroll={false} onNavigate={scrollToArticleStart}>
      {children}
    </Link>
  );
}
