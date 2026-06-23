import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"

export const SCHEDULE_SYNC_RATE_LIMIT_MS = 60 * 60 * 1000

const SCHEDULE_SYNC_RATE_LIMIT_DOC_ID = "manual_schedule_sync"

type RateLimitDoc = {
  lastTriggeredAt?: {
    toMillis?: () => number
    seconds?: number
  }
}

export type ScheduleSyncRateLimit = {
  allowed: boolean
  retryAfterSeconds: number
  nextAllowedAt?: string
}

export function evaluateScheduleSyncRateLimit(
  lastTriggeredMs: number | undefined,
  nowMs = Date.now(),
): ScheduleSyncRateLimit {
  if (lastTriggeredMs === undefined) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const nextAllowedMs = lastTriggeredMs + SCHEDULE_SYNC_RATE_LIMIT_MS
  if (nowMs >= nextAllowedMs) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((nextAllowedMs - nowMs) / 1000),
    nextAllowedAt: new Date(nextAllowedMs).toISOString(),
  }
}

export async function claimScheduleSyncSlot(
  db: Firestore = getAdminDb(),
  nowMs = Date.now(),
): Promise<ScheduleSyncRateLimit> {
  const rateLimitRef = db.collection("rateLimits").doc(SCHEDULE_SYNC_RATE_LIMIT_DOC_ID)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(rateLimitRef)
    const data = snap.exists ? (snap.data() as RateLimitDoc) : undefined
    const status = evaluateScheduleSyncRateLimit(timestampToMillis(data?.lastTriggeredAt), nowMs)

    if (!status.allowed) return status

    tx.set(
      rateLimitRef,
      {
        lastTriggeredAt: Timestamp.fromMillis(nowMs),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return status
  })
}

function timestampToMillis(value: RateLimitDoc["lastTriggeredAt"]) {
  if (!value) return undefined
  if (typeof value.toMillis === "function") return value.toMillis()
  if (typeof value.seconds === "number") return value.seconds * 1000
  return undefined
}
