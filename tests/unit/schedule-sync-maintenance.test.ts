import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const calls: string[] = []

  return {
    calls,
    applyAutomaticMissingBetLossesForUserMatches: vi.fn(async () => {
      calls.push("automaticLossesForUser")
      return { applied: 1, skipped: 0, failed: 0 }
    }),
    finalizeSettledMatches: vi.fn(async () => {
      calls.push("finalizeSettledMatches")
      return { settled: 0, updated: 1, skipped: 0, failed: 0 }
    }),
    hasCompletedFinalScore: vi.fn(() => true),
    lockExpiredOpenMatches: vi.fn(async () => {
      calls.push("lockExpiredOpenMatches")
      return 0
    }),
    normalizePendingBetStakesForUser: vi.fn(async () => {
      calls.push("normalizePendingBetStakesForUser")
      return { adjusted: 1, skipped: 0, failed: 0 }
    }),
    resetInvalidSettledBetsForUser: vi.fn(async () => {
      calls.push("resetInvalidSettledBetsForUser")
      return { repaired: 1, failed: 0 }
    }),
    settleCompletedMatchesForUserMatches: vi.fn(async () => {
      calls.push("settleCompletedMatchesForUser")
      return { settled: 1, updated: 0, skipped: 0, failed: 0 }
    }),
    shouldAutoLoseMissingBets: vi.fn(() => true),
    syncWorldCupSchedule: vi.fn(async () => {
      calls.push("syncWorldCupSchedule")
      return { source: "espn", created: 0, updated: 1, skipped: 0, failed: 0 }
    }),
  }
})

vi.mock("@/lib/betting", () => ({
  applyAutomaticMissingBetLossesForUserMatches: mocks.applyAutomaticMissingBetLossesForUserMatches,
  finalizeSettledMatches: mocks.finalizeSettledMatches,
  hasCompletedFinalScore: mocks.hasCompletedFinalScore,
  normalizePendingBetStakesForUser: mocks.normalizePendingBetStakesForUser,
  resetInvalidSettledBetsForUser: mocks.resetInvalidSettledBetsForUser,
  settleCompletedMatchesForUserMatches: mocks.settleCompletedMatchesForUserMatches,
  shouldAutoLoseMissingBets: mocks.shouldAutoLoseMissingBets,
}))

vi.mock("@/lib/schedule-sync", () => ({
  lockExpiredOpenMatches: mocks.lockExpiredOpenMatches,
  syncWorldCupSchedule: mocks.syncWorldCupSchedule,
}))

beforeEach(() => {
  mocks.calls.length = 0
  vi.clearAllMocks()
})

describe("runScheduleSyncMaintenanceStep", () => {
  it("runs a single requested maintenance step", async () => {
    const db = {} as FirebaseFirestore.Firestore
    const { runScheduleSyncMaintenanceStep } = await import("@/lib/schedule-sync-maintenance")

    const result = await runScheduleSyncMaintenanceStep("settle", db, {
      userId: "user-1",
      matchIds: ["match-1"],
    })

    expect(result).toEqual({ step: "settle", settlement: { settled: 1, updated: 0, skipped: 0, failed: 0 } })
    expect(mocks.calls).toEqual(["settleCompletedMatchesForUser"])
    expect(mocks.settleCompletedMatchesForUserMatches).toHaveBeenCalledWith("user-1", ["match-1"], db)
    expect(mocks.syncWorldCupSchedule).not.toHaveBeenCalled()
  })

  it("runs user-scoped maintenance steps with provided match ids", async () => {
    const db = {} as FirebaseFirestore.Firestore
    const { runScheduleSyncMaintenanceStep } = await import("@/lib/schedule-sync-maintenance")

    const result = await runScheduleSyncMaintenanceStep("repair-bets", db, {
      userId: "user-1",
      matchIds: ["match-1"],
    })

    expect(result).toEqual({ step: "repair-bets", repairedBets: { repaired: 1, failed: 0 } })
    expect(mocks.calls).toEqual(["resetInvalidSettledBetsForUser"])
    expect(mocks.resetInvalidSettledBetsForUser).toHaveBeenCalledWith("user-1", db, ["match-1"])
  })
})

describe("runScheduleSyncMaintenance", () => {
  it("runs schedule sync and context-scoped post-sync maintenance end to end", async () => {
    const db = maintenanceContextDb()
    const { runScheduleSyncMaintenance } = await import("@/lib/schedule-sync-maintenance")

    const result = await runScheduleSyncMaintenance(db)

    expect(result).toEqual({
      sync: { source: "espn", created: 0, updated: 1, skipped: 0, failed: 0 },
      locked: 0,
      normalizedStakes: { adjusted: 1, skipped: 0, failed: 0 },
      repairedBets: { repaired: 1, failed: 0 },
      automaticLosses: { applied: 1, skipped: 0, failed: 0 },
      settlement: { settled: 1, updated: 1, skipped: 0, failed: 0 },
    })
    expect(mocks.calls).toEqual([
      "syncWorldCupSchedule",
      "lockExpiredOpenMatches",
      "normalizePendingBetStakesForUser",
      "resetInvalidSettledBetsForUser",
      "automaticLossesForUser",
      "settleCompletedMatchesForUser",
      "finalizeSettledMatches",
    ])
    expect(mocks.syncWorldCupSchedule).toHaveBeenCalledWith(db)
    expect(mocks.normalizePendingBetStakesForUser).toHaveBeenCalledWith("user-1", db, ["match-1"])
    expect(mocks.resetInvalidSettledBetsForUser).toHaveBeenCalledWith("user-1", db, ["match-1"])
    expect(mocks.applyAutomaticMissingBetLossesForUserMatches).toHaveBeenCalledWith(
      "user-1",
      ["match-1"],
      expect.objectContaining({ uid: "schedule-sync" }),
      db,
    )
    expect(mocks.settleCompletedMatchesForUserMatches).toHaveBeenCalledWith("user-1", ["match-1"], db)
    expect(mocks.finalizeSettledMatches).toHaveBeenCalledWith(["match-1"], db)
  })
})

function maintenanceContextDb() {
  return {
    collection: (name: string) => ({
      get: async () => {
        if (name === "users") {
          return {
            docs: [
              {
                id: "user-1",
                data: () => ({ displayName: "User One" }),
              },
            ],
          }
        }

        if (name === "matches") {
          return {
            docs: [
              {
                id: "match-1",
                data: () => ({
                  status: "LOCKED",
                  kickoffAt: { toMillis: () => Date.parse("2026-06-25T00:00:00.000Z") },
                  homeScore: 1,
                  awayScore: 0,
                }),
              },
            ],
          }
        }

        return { docs: [] }
      },
    }),
  } as unknown as FirebaseFirestore.Firestore
}
