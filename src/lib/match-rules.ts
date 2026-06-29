import type { MatchStage } from "@/types/betting"

export const KNOCKOUT_MATCH_STAGES = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "THIRD_PLACE",
  "FINAL",
] as const satisfies readonly MatchStage[]

export function isKnockoutStage(stage?: string | null) {
  return KNOCKOUT_MATCH_STAGES.includes(stage as (typeof KNOCKOUT_MATCH_STAGES)[number])
}
