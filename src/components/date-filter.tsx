"use client"

import { addDaysToLocalDateKey, formatLocalDateLabel } from "@/lib/time"

type DateFilterProps = {
  title: string
  selectedDateKey: string | null
  todayDateKey: string
  count: number
  singularLabel: string
  pluralLabel: string
  onSelectDate: (dateKey: string | null) => void
}

export function DateFilter({
  title,
  selectedDateKey,
  todayDateKey,
  count,
  singularLabel,
  pluralLabel,
  onSelectDate,
}: DateFilterProps) {
  const anchorDateKey = selectedDateKey ?? todayDateKey
  const previousDateKey = addDaysToLocalDateKey(anchorDateKey, -1)
  const nextDateKey = addDaysToLocalDateKey(anchorDateKey, 1)
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey) : "All dates"

  return (
    <section className="panel grid gap-4 p-3">
      <div>
        <h2 className="text-base font-black">{title}</h2>
        <p className="mt-1 text-sm text-stone-600">
          {selectedDateLabel} - {count} {count === 1 ? singularLabel : pluralLabel}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`button whitespace-nowrap ${selectedDateKey ? "secondary" : ""}`} onClick={() => onSelectDate(null)}>
          All dates
        </button>
        <button type="button" className={`button whitespace-nowrap ${selectedDateKey === todayDateKey ? "" : "secondary"}`} onClick={() => onSelectDate(todayDateKey)}>
          Today
        </button>
        <button type="button" className="button secondary whitespace-nowrap" onClick={() => onSelectDate(previousDateKey)}>
          {formatLocalDateLabel(previousDateKey)}
        </button>
        <button type="button" className="button date-filter-current whitespace-nowrap" onClick={() => onSelectDate(anchorDateKey)}>
          <span className="grid gap-0.5 text-left">
            <span className="text-xs font-black uppercase leading-none">Selected</span>
            <span>{formatLocalDateLabel(anchorDateKey)}</span>
          </span>
        </button>
        <button type="button" className="button secondary whitespace-nowrap" onClick={() => onSelectDate(nextDateKey)}>
          {formatLocalDateLabel(nextDateKey)}
        </button>
        <label className="button secondary date-picker-button" aria-label="Choose match date">
          <span aria-hidden="true">📅</span>
          <input
            type="date"
            value={selectedDateKey ?? ""}
            onChange={(event) => {
              if (event.target.value) onSelectDate(event.target.value)
            }}
          />
        </label>
      </div>
    </section>
  )
}
