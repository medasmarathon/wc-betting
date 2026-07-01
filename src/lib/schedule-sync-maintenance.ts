import type { Firestore } from "firebase-admin/firestore"
import {
  applyAutomaticMissingBetLossesForExpiredMatches,
  normalizePendingBetStakesForConfiguredMatches,
  resetInvalidSettledBets,
  settleCompletedMatches,
} from "@/lib/betting"
import { getAdminDb } from "@/lib/firebase/admin"
import { lockExpiredOpenMatches, syncWorldCupSchedule } from "@/lib/schedule-sync"

export type ScheduleSyncMaintenanceResult = {
  sync: Awaited<ReturnType<typeof syncWorldCupSchedule>>
  locked: Awaited<ReturnType<typeof lockExpiredOpenMatches>>
  normalizedStakes: Awaited<ReturnType<typeof normalizePendingBetStakesForConfiguredMatches>>
  repairedBets: Awaited<ReturnType<typeof resetInvalidSettledBets>>
  automaticLosses: Awaited<ReturnType<typeof applyAutomaticMissingBetLossesForExpiredMatches>>
  settlement: Awaited<ReturnType<typeof settleCompletedMatches>>
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
