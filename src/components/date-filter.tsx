"use client"

import { useI18n } from "@/components/language-provider"
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
  const { locale, t } = useI18n()
  const anchorDateKey = selectedDateKey ?? todayDateKey
  const previousDateKey = addDaysToLocalDateKey(anchorDateKey, -1)
  const nextDateKey = addDaysToLocalDateKey(anchorDateKey, 1)
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey, locale) : t.common.allDates

  return (
    <section className="panel grid gap-4 p-3">
      <div>
        <h2 className="text-base font-black">{title}</h2>
        <p className="page-subtitle mt-1 text-sm">
          {selectedDateLabel} - {count} {count === 1 ? singularLabel : pluralLabel}
        </p>
      </div>
      <div className="date-filter-actions">
        <div className="date-filter-quick">
          <button type="button" className={`button whitespace-nowrap ${selectedDateKey ? "secondary" : ""}`} onClick={() => onSelectDate(null)}>
            {t.common.allDates}
          </button>
          <button type="button" className={`button whitespace-nowrap ${selectedDateKey === todayDateKey ? "" : "secondary"}`} onClick={() => onSelectDate(todayDateKey)}>
            {t.common.today}
          </button>
          <label className="button secondary date-picker-button" aria-label={t.common.chooseDate}>
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
        <div className="date-filter-stepper" aria-label={t.common.dateNavigation}>
          <button type="button" className="button secondary whitespace-nowrap" onClick={() => onSelectDate(previousDateKey)}>
            {t.common.previous}
          </button>
          <button type="button" className="button date-filter-current whitespace-nowrap" onClick={() => onSelectDate(anchorDateKey)}>
            <span className="grid gap-0.5 text-left">
              <span className="text-xs font-black uppercase leading-none">{t.common.selected}</span>
              <span>{formatLocalDateLabel(anchorDateKey, locale)}</span>
            </span>
          </button>
          <button type="button" className="button secondary whitespace-nowrap" onClick={() => onSelectDate(nextDateKey)}>
            {t.common.next}
          </button>
        </div>
      </div>
    </section>
  )
}
