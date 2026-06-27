"use client"

type PaginationControlsProps = {
  label: string
  page: number
  pageCount: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}

export const DEFAULT_PAGE_SIZE = 10

export function PaginationControls({
  label,
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationControlsProps) {
  const safePageCount = Math.max(1, pageCount)
  const safePage = Math.min(Math.max(1, page), safePageCount)
  const start = totalItems ? (safePage - 1) * pageSize + 1 : 0
  const end = Math.min(totalItems, safePage * pageSize)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="page-subtitle">
        {label}: {start}-{end} of {totalItems}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="button secondary" type="button" onClick={() => onPageChange(1)} disabled={safePage <= 1}>
          First
        </button>
        <button className="button secondary" type="button" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}>
          Previous
        </button>
        <span className="status-badge status-neutral self-center">
          Page {safePage} of {safePageCount}
        </span>
        <button
          className="button secondary"
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safePageCount}
        >
          Next
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => onPageChange(safePageCount)}
          disabled={safePage >= safePageCount}
        >
          Last
        </button>
      </div>
    </div>
  )
}

export function pageCountFor(totalItems: number, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export function pageItems<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * pageSize

  return items.slice(start, start + pageSize)
}
