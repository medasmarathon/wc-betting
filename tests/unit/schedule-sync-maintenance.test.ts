import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const calls: string[] = []

  return {
    calls,
    applyAutomaticMissingBetLossesForExpiredMatches: vi.fn(async () => {
      calls.push("automaticLosses")
      return { applied: 0, skipped: 0, failed: 0 }
    }),
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

describe("runScheduleSyncMaintenance", () => {
  it("runs schedule sync and post-sync maintenance in settlement order", async () => {
    const db = {} as FirebaseFirestore.Firestore
    const { runScheduleSyncMaintenance } = await import("@/lib/schedule-sync-maintenance")

    const result = await runScheduleSyncMaintenance(db)

    expect(result).toEqual({
      sync: { source: "espn", created: 0, updated: 1, skipped: 0, failed: 0 },
      locked: 0,
      normalizedStakes: { adjusted: 0, skipped: 0, failed: 0 },
      repairedBets: { repaired: 0, failed: 0 },
      automaticLosses: { applied: 0, skipped: 0, failed: 0 },
      settlement: { settled: 1, updated: 0, skipped: 0, failed: 0 },
    })
    expect(mocks.calls).toEqual([
      "syncWorldCupSchedule",
      "lockExpiredOpenMatches",
      "normalizePendingBetStakes",
      "resetInvalidSettledBets",
      "automaticLosses",
      "settleCompletedMatches",
    ])
    expect(mocks.syncWorldCupSchedule).toHaveBeenCalledWith(db)
    expect(mocks.settleCompletedMatches).toHaveBeenCalledWith(db)
  })
})
