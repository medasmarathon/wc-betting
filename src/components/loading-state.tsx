"use client"

type LoadingPanelProps = {
  label: string
}

type CardListSkeletonProps = LoadingPanelProps & {
  count?: number
}

type TableSkeletonProps = LoadingPanelProps & {
  rows?: number
  columns?: number
}

export function LoadingPanel({ label }: LoadingPanelProps) {
  return (
    <div className="panel text-subtle p-4 text-sm" role="status" aria-live="polite">
      {label}
    </div>
  )
}

export function CardListSkeleton({ label, count = 3 }: CardListSkeletonProps) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite">
      <LoadingPanel label={label} />
      <div className="grid gap-4">
        {Array.from({ length: count }, (_, index) => (
          <article key={index} className="panel grid gap-3 p-4" aria-hidden="true">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <div className="skeleton-line h-5 w-2/3" />
                <div className="skeleton-line h-4 w-1/2" />
              </div>
              <div className="skeleton-line h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton-line h-10 w-full" />
          </article>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ label, rows = 4, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite">
      <LoadingPanel label={label} />
      <div className="panel table-shell" aria-hidden="true">
        <table className="table">
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <td key={columnIndex} data-label="">
                    <div className={`skeleton-line h-4 ${columnIndex === 0 ? "w-32" : "w-20"}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
