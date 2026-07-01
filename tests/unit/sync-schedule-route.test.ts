import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const calls: string[] = []

  return {
    calls,
    applyAutomaticMissingBetLossesForExpiredMatches: vi.fn(async () => {
      calls.push("automaticLosses")
      return { applied: 0, skipped: 0, failed: 0 }
    }),
    claimScheduleSyncSlot: vi.fn(),
    lockExpiredOpenMatches: vi.fn(async () => {
      calls.push("lockExpiredOpenMatches")
      return 0
    }),
    normalizePendingBetStakesForConfiguredMatches: vi.fn(async () => {
      calls.push("normalizePendingBetStakes")
      return { adjusted: 0, skipped: 0, failed: 0 }
    }),
    resetInvalidSettledBets: vi.fn(async () => {
      calls.push("resetInvalidSettledBets")
      return { repaired: 0, failed: 0 }
    }),
    settleCompletedMatches: vi.fn(async () => {
      calls.push("settleCompletedMatches")
      return { settled: 1, updated: 0, skipped: 0, failed: 0 }
    }),
    syncWorldCupSchedule: vi.fn(async () => {
      calls.push("syncWorldCupSchedule")
      return { source: "espn", created: 0, updated: 1, skipped: 0, failed: 0 }
    }),
  }
})

vi.mock("@/lib/betting", () => ({
  applyAutomaticMissingBetLossesForExpiredMatches: mocks.applyAutomaticMissingBetLossesForExpiredMatches,
  normalizePendingBetStakesForConfiguredMatches: mocks.normalizePendingBetStakesForConfiguredMatches,
  resetInvalidSettledBets: mocks.resetInvalidSettledBets,
  settleCompletedMatches: mocks.settleCompletedMatches,
}))

vi.mock("@/lib/schedule-sync", () => ({
  lockExpiredOpenMatches: mocks.lockExpiredOpenMatches,
  syncWorldCupSchedule: mocks.syncWorldCupSchedule,
}))

vi.mock("@/lib/auth", () => ({
  handleRouteError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/schedule-sync-rate-limit", () => ({
  claimScheduleSyncSlot: mocks.claimScheduleSyncSlot,
}))

describe("sync schedule cron route", () => {
  beforeEach(() => {
    mocks.calls.length = 0
    process.env.CRON_SECRET = "cron-secret"
    vi.clearAllMocks()
  })

  it("settles completed matches after syncing finished results", async () => {
    const { GET } = await import("@/app/api/cron/sync-schedule/route")

    const response = await GET(
      new Request("http://localhost/api/cron/sync-schedule", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    )
    const json = await response.json()

    expect(response.ok).toBe(true)
    expect(json.settlement).toEqual({ settled: 1, updated: 0, skipped: 0, failed: 0 })
    expect(mocks.calls).toEqual([
      "syncWorldCupSchedule",
      "lockExpiredOpenMatches",
      "normalizePendingBetStakes",
      "resetInvalidSettledBets",
      "automaticLosses",
      "settleCompletedMatches",
    ])
    expect(mocks.settleCompletedMatches).toHaveBeenCalledTimes(1)
  })
})
