import { describe, expect, it } from "vitest"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { adjustBalanceSchema, inviteInputSchema, placeBetSchema } from "@/lib/validation"

describe("inviteInputSchema", () => {
  it("normalizes email and defaults to user role", () => {
    expect(inviteInputSchema.parse({ email: " Friend@Example.com " })).toEqual({
      email: "friend@example.com",
      role: "USER",
    })
  })

  it("converts a blank display name to undefined", () => {
    expect(
      inviteInputSchema.parse({
        email: "admin@example.com",
        displayName: "   ",
        role: "ADMIN",
      }),
    ).toEqual({
      email: "admin@example.com",
      displayName: undefined,
      role: "ADMIN",
    })
  })

  it("rejects invalid roles", () => {
    expect(() => inviteInputSchema.parse({ email: "friend@example.com", role: "OWNER" })).toThrow()
  })
})

describe("placeBetSchema", () => {
  const validBet = {
    matchId: "match-1",
    pick: "HOME",
    stake: DEFAULT_BET_STAKE,
  }

  it("accepts a positive integer stake", () => {
    expect(placeBetSchema.parse(validBet)).toMatchObject(validBet)
    expect(placeBetSchema.parse({ ...validBet, stake: 40 })).toMatchObject({ ...validBet, stake: 40 })
  })

  it("rejects non-positive stakes", () => {
    expect(() => placeBetSchema.parse({ ...validBet, stake: 0 })).toThrow()
  })
})

describe("adjustBalanceSchema", () => {
  it("accepts a target points-left balance", () => {
    expect(adjustBalanceSchema.parse({ balanceAfter: "1200", reason: "Admin correction" })).toEqual({
      balanceAfter: 1200,
      reason: "Admin correction",
    })
  })

  it("rejects ambiguous balance inputs", () => {
    expect(() =>
      adjustBalanceSchema.parse({ amount: 100, balanceAfter: 1200, reason: "Admin correction" }),
    ).toThrow()
  })

  it("requires either an amount or target balance", () => {
    expect(() => adjustBalanceSchema.parse({ reason: "Admin correction" })).toThrow()
  })
})
