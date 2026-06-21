import { z } from "zod"

const oddsSchema = z.object({
  HOME: z.coerce.number().positive(),
  DRAW: z.coerce.number().positive(),
  AWAY: z.coerce.number().positive(),
})

export const placeBetSchema = z.object({
  matchId: z.string().min(1),
  pick: z.enum(["HOME", "DRAW", "AWAY"]),
  stake: z.coerce.number().int().positive().max(100000),
  predictedHomeScore: z.coerce.number().int().min(0).max(99).optional(),
  predictedAwayScore: z.coerce.number().int().min(0).max(99).optional(),
})

export const matchInputSchema = z.object({
  homeTeam: z.string().trim().min(1),
  awayTeam: z.string().trim().min(1),
  homeTeamCode: z.string().trim().optional(),
  awayTeamCode: z.string().trim().optional(),
  groupName: z.string().trim().optional(),
  stage: z
    .enum(["GROUP", "ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "THIRD_PLACE", "FINAL"])
    .default("GROUP"),
  kickoffAt: z.coerce.date(),
  status: z
    .enum(["SCHEDULED", "OPEN", "LOCKED", "LIVE", "COMPLETED", "SETTLED", "VOIDED"])
    .default("OPEN"),
  odds: oddsSchema.default({ HOME: 2, DRAW: 3, AWAY: 2 }),
})

export const resultInputSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
})

export const adjustBalanceSchema = z.object({
  amount: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  reason: z.string().trim().min(3),
})
