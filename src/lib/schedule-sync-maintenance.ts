import type { Firestore } from "firebase-admin/firestore"
import {
  applyAutomaticMissingBetLossesForUserMatches,
  finalizeSettledMatches,
  hasCompletedFinalScore,
  normalizePendingBetStakesForUser,
  resetInvalidSettledBetsForUser,
  settleCompletedMatchesForUserMatches,
  shouldAutoLoseMissingBets,
  type InvalidSettledBetRepairResult,
  type MissingBetLossResult,
  type StakeNormalizationResult,
} from "@/lib/betting"
import { getAdminDb } from "@/lib/firebase/admin"
import { lockExpiredOpenMatches, syncWorldCupSchedule } from "@/lib/schedule-sync"
import type { MatchDoc, UserDoc } from "@/types/betting"

export const SCHEDULE_SYNC_MAINTENANCE_STEPS = [
  "sync",
  "lock",
  "normalize-stakes",
  "repair-bets",
  "automatic-losses",
  "settle",
] as const

export type ScheduleSyncMaintenanceStep = (typeof SCHEDULE_SYNC_MAINTENANCE_STEPS)[number]

export type ScheduleSyncMaintenanceResult = {
  sync: Awaited<ReturnType<typeof syncWorldCupSchedule>>
  locked: Awaited<ReturnType<typeof lockExpiredOpenMatches>>
  normalizedStakes: StakeNormalizationResult
  repairedBets: InvalidSettledBetRepairResult
  automaticLosses: MissingBetLossResult
  settlement: SettlementMaintenanceResult
}

type SettlementMaintenanceResult = {
  settled: number
  updated: number
  skipped: number
  failed: number
}

export type ScheduleSyncMaintenanceContext = {
  users: { id: string; displayName: string }[]
  matchIds: string[]
  automaticLossMatchIds: string[]
  settlementMatchIds: string[]
}

export type ScheduleSyncMaintenanceStepOptions = {
  userId?: string
  matchIds?: string[]
  finalize?: boolean
}

export type ScheduleSyncMaintenanceStepResult =
  | { step: "sync"; sync: ScheduleSyncMaintenanceResult["sync"] }
  | { step: "lock"; locked: ScheduleSyncMaintenanceResult["locked"]; context: ScheduleSyncMaintenanceContext }
  | { step: "normalize-stakes"; normalizedStakes: ScheduleSyncMaintenanceResult["normalizedStakes"] }
  | { step: "repair-bets"; repairedBets: ScheduleSyncMaintenanceResult["repairedBets"] }
  | { step: "automatic-losses"; automaticLosses: ScheduleSyncMaintenanceResult["automaticLosses"] }
  | { step: "settle"; settlement: ScheduleSyncMaintenanceResult["settlement"] }

export async function runScheduleSyncMaintenanceStep(
  step: ScheduleSyncMaintenanceStep,
  db: Firestore = getAdminDb(),
  options: ScheduleSyncMaintenanceStepOptions = {},
): Promise<ScheduleSyncMaintenanceStepResult> {
  switch (step) {
    case "sync":
      return { step, sync: await syncWorldCupSchedule(db) }
    case "lock":
      return { step, locked: await lockExpiredOpenMatches(db), context: await buildScheduleSyncMaintenanceContext(db) }
    case "normalize-stakes":
      assertUserScopedStepOptions(step, options)
      return {
        step,
        normalizedStakes: await normalizePendingBetStakesForUser(options.userId, db, options.matchIds),
      }
    case "repair-bets":
      assertUserScopedStepOptions(step, options)
      return {
        step,
        repairedBets: await resetInvalidSettledBetsForUser(options.userId, db, options.matchIds),
      }
    case "automatic-losses":
      assertUserScopedStepOptions(step, options)
      return {
        step,
        automaticLosses: await applyAutomaticMissingBetLossesForUserMatches(
          options.userId,
          options.matchIds ?? [],
          systemActor(),
          db,
        ),
      }
    case "settle":
      assertUserScopedStepOptions(step, options)
      const settlement = await settleCompletedMatchesForUserMatches(options.userId, options.matchIds ?? [], db)
      if (options.finalize) {
        const finalized = await finalizeSettledMatches(options.matchIds ?? [], db)
        settlement.updated += finalized.updated
        settlement.skipped += finalized.skipped
        settlement.failed += finalized.failed
      }
      return { step, settlement }
  }
}

function assertUserScopedStepOptions(
  step: ScheduleSyncMaintenanceStep,
  options: ScheduleSyncMaintenanceStepOptions,
): asserts options is ScheduleSyncMaintenanceStepOptions & { userId: string } {
  if (!options.userId) throw new Error(`${step} requires userId`)
}

export async function runScheduleSyncMaintenance(
  db: Firestore = getAdminDb(),
): Promise<ScheduleSyncMaintenanceResult> {
  const sync = await syncWorldCupSchedule(db)
  const locked = await lockExpiredOpenMatches(db)
  const context = await buildScheduleSyncMaintenanceContext(db)
  const normalizedStakes = emptyStakeNormalizationResult()
  const repairedBets = emptyInvalidSettledBetRepairResult()
  const automaticLosses = emptyMissingBetLossResult()
  const settlement = emptySettlementMaintenanceResult()

  for (const user of context.users) {
    addStakeNormalizationResult(
      normalizedStakes,
      await normalizePendingBetStakesForUser(user.id, db, context.matchIds),
    )
    addInvalidSettledBetRepairResult(
      repairedBets,
      await resetInvalidSettledBetsForUser(user.id, db, context.matchIds),
    )
    addMissingBetLossResult(
      automaticLosses,
      await applyAutomaticMissingBetLossesForUserMatches(
        user.id,
        context.automaticLossMatchIds,
        systemActor(),
        db,
      ),
    )
    addSettlementMaintenanceResult(
      settlement,
      await settleCompletedMatchesForUserMatches(user.id, context.settlementMatchIds, db),
    )
  }

  addSettlementMaintenanceResult(settlement, await finalizeSettledMatches(context.settlementMatchIds, db))

  return { sync, locked, normalizedStakes, repairedBets, automaticLosses, settlement }
}

async function buildScheduleSyncMaintenanceContext(db: Firestore): Promise<ScheduleSyncMaintenanceContext> {
  const [usersSnap, matchesSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("matches").get(),
  ])

  const users = usersSnap.docs.map((doc) => {
    const user = doc.data() as UserDoc
    return { id: doc.id, displayName: user.displayName }
  })
  const matchIds: string[] = []
  const automaticLossMatchIds: string[] = []
  const settlementMatchIds: string[] = []

  for (const doc of matchesSnap.docs) {
    const match = doc.data() as MatchDoc
    matchIds.push(doc.id)
    if (["LOCKED", "LIVE", "COMPLETED", "SETTLED"].includes(match.status) && shouldAutoLoseMissingBets(match.kickoffAt)) {
      automaticLossMatchIds.push(doc.id)
    }
    if (hasCompletedFinalScore(match)) {
      settlementMatchIds.push(doc.id)
    }
  }

  return { users, matchIds, automaticLossMatchIds, settlementMatchIds }
}

function systemActor() {
  return {
    uid: "schedule-sync",
    email: "system",
    displayName: "Schedule Sync",
    role: "ADMIN" as const,
    isActive: true,
  }
}

function emptyStakeNormalizationResult(): ScheduleSyncMaintenanceResult["normalizedStakes"] {
  return { adjusted: 0, skipped: 0, failed: 0 }
}

function emptyInvalidSettledBetRepairResult(): ScheduleSyncMaintenanceResult["repairedBets"] {
  return { repaired: 0, failed: 0 }
}

function emptyMissingBetLossResult(): ScheduleSyncMaintenanceResult["automaticLosses"] {
  return { applied: 0, skipped: 0, failed: 0 }
}

function emptySettlementMaintenanceResult(): ScheduleSyncMaintenanceResult["settlement"] {
  return { settled: 0, updated: 0, skipped: 0, failed: 0 }
}

function addStakeNormalizationResult(
  target: ScheduleSyncMaintenanceResult["normalizedStakes"],
  next: ScheduleSyncMaintenanceResult["normalizedStakes"],
) {
  target.adjusted += next.adjusted
  target.skipped += next.skipped
  target.failed += next.failed
}

function addInvalidSettledBetRepairResult(
  target: ScheduleSyncMaintenanceResult["repairedBets"],
  next: ScheduleSyncMaintenanceResult["repairedBets"],
) {
  target.repaired += next.repaired
  target.failed += next.failed
}

function addMissingBetLossResult(
  target: ScheduleSyncMaintenanceResult["automaticLosses"],
  next: ScheduleSyncMaintenanceResult["automaticLosses"],
) {
  target.applied += next.applied
  target.skipped += next.skipped
  target.failed += next.failed
}

function addSettlementMaintenanceResult(
  target: ScheduleSyncMaintenanceResult["settlement"],
  next: ScheduleSyncMaintenanceResult["settlement"],
) {
  target.settled += next.settled
  target.updated += next.updated
  target.skipped += next.skipped
  target.failed += next.failed
}
