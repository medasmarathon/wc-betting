import type { FirebaseDate } from "@/types/betting"

export function toDate(value: FirebaseDate | Date | string | number): Date {
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (value.toDate) return value.toDate()
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000))
  }
  return new Date(0)
}

export function toIso(value: FirebaseDate | Date | string | number | undefined): string | undefined {
  if (!value) return undefined
  return toDate(value).toISOString()
}

export function formatKickoff(value: FirebaseDate | Date | string | number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(toDate(value))
}

export function getLocalDateKey(value: FirebaseDate | Date | string | number): string {
  const date = toDate(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function addDaysToLocalDateKey(dateKey: string, days: number): string {
  const date = dateFromLocalDateKey(dateKey)
  date.setDate(date.getDate() + days)

  return getLocalDateKey(date)
}

export function formatLocalDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(dateFromLocalDateKey(dateKey))
}

function dateFromLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number)

  return new Date(year, month - 1, day)
}
