import { z } from "zod"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { DEFAULT_LOCALE, formatMessage, messages, unitLabel } from "@/lib/i18n"

const optionalDisplayNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(120).optional(),
)

export const placeBetSchema = z.object({
  matchId: z.string().min(1),
  pick: z.enum(["HOME", "DRAW", "AWAY"]),
  stake: z.coerce
    .number()
    .int()
    .refine(
      (value) => value === DEFAULT_BET_STAKE,
      formatMessage(messages[DEFAULT_LOCALE].errors.stakeExact, { amount: unitLabel(DEFAULT_BET_STAKE) }),
    ),
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
})

export const resultInputSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
  resultPick: z.enum(["HOME", "DRAW", "AWAY"]).optional(),
})

export const adjustBalanceSchema = z.object({
  amount: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  reason: z.string().trim().min(3),
})

export const inviteInputSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  displayName: optionalDisplayNameSchema,
  role: z.enum(["USER", "ADMIN"]).default("USER"),
})

export const groupInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
})
