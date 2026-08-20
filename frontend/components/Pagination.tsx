import Link from "next/link";
import { buildQueryString } from "@/lib/format";
import type { Pagination as PaginationData } from "@/types";

interface PaginationProps {
  pagination: PaginationData;
  region?: string;
  examType?: string;
  subject?: string;
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i > 1 && i < total) pages.add(i);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export default function Pagination({
  pagination,
  region,
  examType,
  subject,
}: PaginationProps) {
  const { page, totalPages } = pagination;

  if (totalPages <= 1) return null;

  const makeHref = (p: number) =>
    `/${buildQueryString({
      region,
      examType,
      subject,
      page: p > 1 ? p : undefined,
    })}`;

  const pages = pageNumbers(page, totalPages);

  return (
    <nav
      className="flex justify-center gap-space-1 px-space-5 py-space-5"
      aria-label="分页"
    >
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          className="px-4 py-2 text-[14px] font-medium text-text-secondary transition-colors duration-150 hover:text-accent"
          aria-label="上一页"
        >
          上一页
        </Link>
      ) : (
        <span
          className="cursor-not-allowed px-4 py-2 text-[14px] font-medium text-text-tertiary opacity-50"
          aria-disabled="true"
        >
          上一页
        </span>
      )}

      {pages.map((p, index) => {
        const prev = pages[index - 1];
        const showEllipsis = prev != null && p - prev > 1;

        return (
          <span key={p} className="contents">
            {showEllipsis && (
              <span className="px-2 py-2 text-[14px] text-text-tertiary" aria-hidden>
                …
              </span>
            )}
            <Link
              href={makeHref(p)}
              className={`px-4 py-2 text-[14px] font-medium transition-colors duration-150 ${
                p === page
                  ? "bg-accent text-accent-contrast"
                  : "text-text-secondary hover:text-accent"
              }`}
              aria-label={`第 ${p} 页`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          </span>
        );
      })}

      {page < totalPages ? (
        <Link
          href={makeHref(page + 1)}
          className="px-4 py-2 text-[14px] font-medium text-text-secondary transition-colors duration-150 hover:text-accent"
          aria-label="下一页"
        >
          下一页
        </Link>
      ) : (
        <span
          className="cursor-not-allowed px-4 py-2 text-[14px] font-medium text-text-tertiary opacity-50"
          aria-disabled="true"
        >
          下一页
        </span>
      )}
    </nav>
  );
}
