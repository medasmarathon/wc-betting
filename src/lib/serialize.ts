import { toIso } from "@/lib/time"
import type { BetDoc } from "@/types/betting"

export function serializeDoc<T extends Record<string, unknown>>(id: string, data: T) {
  return {
    id,
    ...Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, serializeValue(value)]),
    ),
  }
}

export function serializeBetDoc(id: string, data: BetDoc) {
  const serialized = serializeDoc(id, data as unknown as Record<string, unknown>) as Record<string, unknown> & {
    id: string
  }
  delete serialized.predictedHomeScore
  delete serialized.predictedAwayScore
  return serialized
}

function serializeValue(value: unknown): unknown {
  if (!value) return value
  if (typeof value !== "object") return value
  if ("toDate" in value || "seconds" in value) return toIso(value as never)
  if (Array.isArray(value)) return value.map(serializeValue)
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serializeValue(child)]))
}
