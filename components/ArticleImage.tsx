import Image from "next/image";

const optimizedHosts = new Set([
  "momenti.info",
  "cms.momenti.info",
  "sinjali.com",
  "telegrafi.com",
  "www.telegrafi.com",
  "www.rtklive.com",
  "dukagjini.com",
  "www.dukagjini.com",
]);

type ArticleImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fill?: boolean;
  quality?: number;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
};

function supportsOptimization(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;

  try {
    const imageUrl = new URL(src);
    return imageUrl.protocol === "https:" && optimizedHosts.has(imageUrl.hostname);
  } catch {
    return false;
  }
}

export default function ArticleImage({
  src,
  alt,
  sizes,
  className,
  fill = false,
  quality = 60,
  loading,
  fetchPriority,
}: ArticleImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      {...(fill ? { fill: true } : { width: 1600, height: 1000 })}
      sizes={sizes}
      quality={quality}
      loading={loading ?? "lazy"}
      fetchPriority={fetchPriority}
      unoptimized={!supportsOptimization(src)}
      className={className}
    />
  );
}
