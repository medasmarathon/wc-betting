import type { Firestore } from "firebase-admin/firestore"
import {
  applyAutomaticMissingBetLossesForExpiredMatches,
  normalizePendingBetStakesForConfiguredMatches,
  resetInvalidSettledBets,
  settleCompletedMatches,
} from "@/lib/betting"
import { getAdminDb } from "@/lib/firebase/admin"
import { lockExpiredOpenMatches, syncWorldCupSchedule } from "@/lib/schedule-sync"

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
  normalizedStakes: Awaited<ReturnType<typeof normalizePendingBetStakesForConfiguredMatches>>
  repairedBets: Awaited<ReturnType<typeof resetInvalidSettledBets>>
  automaticLosses: Awaited<ReturnType<typeof applyAutomaticMissingBetLossesForExpiredMatches>>
  settlement: Awaited<ReturnType<typeof settleCompletedMatches>>
}

export type ScheduleSyncMaintenanceStepResult =
  | { step: "sync"; sync: ScheduleSyncMaintenanceResult["sync"] }
  | { step: "lock"; locked: ScheduleSyncMaintenanceResult["locked"] }
  | { step: "normalize-stakes"; normalizedStakes: ScheduleSyncMaintenanceResult["normalizedStakes"] }
  | { step: "repair-bets"; repairedBets: ScheduleSyncMaintenanceResult["repairedBets"] }
  | { step: "automatic-losses"; automaticLosses: ScheduleSyncMaintenanceResult["automaticLosses"] }
  | { step: "settle"; settlement: ScheduleSyncMaintenanceResult["settlement"] }

export async function runScheduleSyncMaintenanceStep(
  step: ScheduleSyncMaintenanceStep,
  db: Firestore = getAdminDb(),
): Promise<ScheduleSyncMaintenanceStepResult> {
  switch (step) {
    case "sync":
      return { step, sync: await syncWorldCupSchedule(db) }
    case "lock":
      return { step, locked: await lockExpiredOpenMatches(db) }
    case "normalize-stakes":
      return { step, normalizedStakes: await normalizePendingBetStakesForConfiguredMatches(db) }
    case "repair-bets":
      return { step, repairedBets: await resetInvalidSettledBets(db) }
    case "automatic-losses":
      return { step, automaticLosses: await applyAutomaticMissingBetLossesForExpiredMatches(db) }
    case "settle":
      return { step, settlement: await settleCompletedMatches(db) }
  }
}

export async function runScheduleSyncMaintenance(
  db: Firestore = getAdminDb(),
): Promise<ScheduleSyncMaintenanceResult> {
  const sync = await syncWorldCupSchedule(db)
  const locked = await lockExpiredOpenMatches(db)
  const normalizedStakes = await normalizePendingBetStakesForConfiguredMatches(db)
  const repairedBets = await resetInvalidSettledBets(db)
  const automaticLosses = await applyAutomaticMissingBetLossesForExpiredMatches(db)
  const settlement = await settleCompletedMatches(db)

  return { sync, locked, normalizedStakes, repairedBets, automaticLosses, settlement }
}
