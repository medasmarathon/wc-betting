import { describe, expect, it } from "vitest"
import {
  evaluateScheduleSyncRateLimit,
  SCHEDULE_SYNC_RATE_LIMIT_MS,
} from "@/lib/schedule-sync-rate-limit"

describe("evaluateScheduleSyncRateLimit", () => {
  it("allows the first manual trigger", () => {
    expect(evaluateScheduleSyncRateLimit(undefined, 1000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    })
  })

  it("blocks triggers inside the hourly window", () => {
    expect(evaluateScheduleSyncRateLimit(1000, 1000 + 30 * 60 * 1000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1800,
      nextAllowedAt: new Date(1000 + SCHEDULE_SYNC_RATE_LIMIT_MS).toISOString(),
    })
  })

  it("allows triggers at the hourly boundary", () => {
    expect(evaluateScheduleSyncRateLimit(1000, 1000 + SCHEDULE_SYNC_RATE_LIMIT_MS)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    })
  })
})
