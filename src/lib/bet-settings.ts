import { toDate } from "@/lib/time"
import type { FirebaseDate, MatchStage } from "@/types/betting"

export const DEFAULT_BET_STAKE = 10
export const KNOCKOUT_BET_STAKE_START_DATE = "2026-07-01"
export const KNOCKOUT_BET_STAKE_START_MS = Date.UTC(2026, 6, 1)

const KNOCKOUT_STAGE_STAKES: Partial<Record<MatchStage, number>> = {
  ROUND_OF_32: 20,
  ROUND_OF_16: 40,
  QUARTER_FINAL: 80,
  SEMI_FINAL: 160,
  THIRD_PLACE: 160,
  FINAL: 320,
}

export function getRequiredBetStake(match: {
  stage?: string | null
  kickoffAt?: FirebaseDate | Date | string | number | null
}) {
  if (!match.kickoffAt || toDate(match.kickoffAt).getTime() < KNOCKOUT_BET_STAKE_START_MS) {
    return DEFAULT_BET_STAKE
  }

  return KNOCKOUT_STAGE_STAKES[match.stage as MatchStage] ?? DEFAULT_BET_STAKE
}
