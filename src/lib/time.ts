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
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value))
}
