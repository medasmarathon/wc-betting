"use client"

import { addDaysToLocalDateKey, formatLocalDateLabel } from "@/lib/time"

type DateFilterProps = {
  title: string
  selectedDateKey: string | null
  todayDateKey: string
  dateKeys: string[]
  count: number
  singularLabel: string
  pluralLabel: string
  onSelectDate: (dateKey: string | null) => void
}

export function DateFilter({
  title,
  selectedDateKey,
  todayDateKey,
  dateKeys,
  count,
  singularLabel,
  pluralLabel,
  onSelectDate,
}: DateFilterProps) {
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey) : "All dates"

  return (
    <section className="panel grid gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black">{title}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {selectedDateLabel} - {count} {count === 1 ? singularLabel : pluralLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="button secondary !px-3"
            aria-label="Previous day"
            disabled={!selectedDateKey}
            onClick={() => {
              if (selectedDateKey) onSelectDate(addDaysToLocalDateKey(selectedDateKey, -1))
            }}
          >
            {"<"}
          </button>
          <button type="button" className={`button ${selectedDateKey === todayDateKey ? "" : "secondary"}`} onClick={() => onSelectDate(todayDateKey)}>
            Today
          </button>
          <button
            type="button"
            className="button secondary !px-3"
            aria-label="Next day"
            disabled={!selectedDateKey}
            onClick={() => {
              if (selectedDateKey) onSelectDate(addDaysToLocalDateKey(selectedDateKey, 1))
            }}
          >
            {">"}
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={`button whitespace-nowrap ${selectedDateKey ? "secondary" : ""}`} onClick={() => onSelectDate(null)}>
          All dates
        </button>
        {dateKeys.map((dateKey) => (
          <button
            key={dateKey}
            type="button"
            className={`button whitespace-nowrap ${selectedDateKey === dateKey ? "" : "secondary"}`}
            onClick={() => onSelectDate(dateKey)}
          >
            {formatLocalDateLabel(dateKey)}
          </button>
        ))}
      </div>
    </section>
  )
}
