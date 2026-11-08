import Link from "next/link";
import { value, type ReportParams } from "@/lib/report-filters";
export default function Pagination({
  page,
  pages,
  params,
}: {
  page: number;
  pages: number;
  params: ReportParams;
}) {
  function href(number: number) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params))
      if (value(val)) query.set(key, value(val));
    query.set("page", String(number));
    return "?" + query;
  }
  return (
    <nav
      aria-label="Страницы"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-muted">
        Страница {page} из {pages}
      </span>
      <div className="flex gap-3">
        {page > 1 && (
          <Link
            className="min-h-11 rounded-lg border border-border px-4 py-3"
            href={href(page - 1)}
          >
            Назад
          </Link>
        )}
        {page < pages && (
          <Link
            className="min-h-11 rounded-lg border border-border px-4 py-3"
            href={href(page + 1)}
          >
            Далее
          </Link>
        )}
      </div>
    </nav>
  );
}
