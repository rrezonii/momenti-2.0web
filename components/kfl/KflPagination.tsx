import Link from "next/link";

function pageHref(page: number) {
  return page === 1 ? "/kycu/artikuj" : `/kycu/artikuj?page=${page}`;
}

export default function KflPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  return (
    <nav className="kfl-pagination" aria-label="Faqet e artikujve">
      <Link aria-disabled={page <= 1} className={`kfl-page-link ${page <= 1 ? "is-disabled" : ""}`} href={pageHref(Math.max(1, page - 1))}>← Të mëparshmit</Link>
      <div className="kfl-page-numbers">
        {first > 1 && <><Link className="kfl-page-link" href={pageHref(1)}>1</Link>{first > 2 && <span>…</span>}</>}
        {pages.map((number) => <Link key={number} aria-current={number === page ? "page" : undefined} className={`kfl-page-link ${number === page ? "is-current" : ""}`} href={pageHref(number)}>{number}</Link>)}
        {last < totalPages && <>{last < totalPages - 1 && <span>…</span>}<Link className="kfl-page-link" href={pageHref(totalPages)}>{totalPages}</Link></>}
      </div>
      <Link aria-disabled={page >= totalPages} className={`kfl-page-link ${page >= totalPages ? "is-disabled" : ""}`} href={pageHref(Math.min(totalPages, page + 1))}>Të ardhshmit →</Link>
    </nav>
  );
}
