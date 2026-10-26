import Link from "next/link";

function pageHref(path: string, page: number) {
  return page === 1 ? path : `${path}?page=${page}`;
}

export default function CategoryPagination({
  path,
  page,
  hasNext,
  locale = "sq",
}: {
  path: string;
  page: number;
  hasNext: boolean;
  locale?: "sq" | "en";
}) {
  const backLabel = locale === "en" ? "← Newer" : "← Mbrapa";
  const nextLabel = locale === "en" ? "Older →" : "Tjetër →";
  const visiblePages = Array.from(
    new Set([1, ...(page > 2 ? [page - 1] : []), page, ...(hasNext ? [page + 1] : [])])
  ).sort((a, b) => a - b);

  return (
    <nav className="category-pagination" aria-label={locale === "en" ? "Category pages" : "Faqet e kategorisë"}>
      {page > 1 ? (
        <Link className="category-page-link category-page-step" href={pageHref(path, page - 1)}>
          {backLabel}
        </Link>
      ) : (
        <span className="category-page-link category-page-step is-disabled">{backLabel}</span>
      )}

      <div className="category-page-numbers">
        {visiblePages.map((number, index) => (
          <span className="category-page-number-wrap" key={number}>
            {index > 0 && number - visiblePages[index - 1] > 1 && <span className="category-page-ellipsis">…</span>}
            <Link
              aria-current={number === page ? "page" : undefined}
              className={`category-page-link category-page-number ${number === page ? "is-current" : ""}`}
              href={pageHref(path, number)}
            >
              {number}
            </Link>
          </span>
        ))}
      </div>

      {hasNext ? (
        <Link className="category-page-link category-page-step" href={pageHref(path, page + 1)}>{nextLabel}</Link>
      ) : (
        <span className="category-page-link category-page-step is-disabled">{nextLabel}</span>
      )}
    </nav>
  );
}
