import { describe, expect, it } from "vitest"
import {
  calculateFundContribution,
  calculateFinalResultPick,
  calculatePayout,
  calculateResultPick,
  canMatchAcceptNewBet,
  canPlaceBet,
  isMatchBettableForUser,
} from "@/lib/betting"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"

describe("calculateResultPick", () => {
  it("returns HOME when home score is greater", () => {
    expect(calculateResultPick(2, 1)).toBe("HOME")
  })

  it("returns DRAW when scores are equal", () => {
    expect(calculateResultPick(1, 1)).toBe("DRAW")
  })

  it("returns AWAY when away score is greater", () => {
    expect(calculateResultPick(0, 3)).toBe("AWAY")
  })
})

describe("calculateFinalResultPick", () => {
  it("uses the source winner when a tied final has an official winner", () => {
    expect(calculateFinalResultPick({ homeScore: 3, awayScore: 3, winner: "HOME" })).toBe("HOME")
  })

  it("falls back to score comparison when the source does not provide a winner", () => {
    expect(calculateFinalResultPick({ homeScore: 1, awayScore: 1 })).toBe("DRAW")
  })
})

describe("calculatePayout", () => {
  it("refunds the original stake", () => {
    expect(calculatePayout(50)).toBe(50)
  })
})

describe("calculateFundContribution", () => {
  it("keeps won stakes out of the party fund", () => {
    expect(calculateFundContribution(10, true)).toBe(0)
  })

  it("contributes lost stakes to the party fund", () => {
    expect(calculateFundContribution(10, false)).toBe(10)
  })
})

describe("DEFAULT_BET_STAKE", () => {
  it("defaults new bet slips to 10 points", () => {
    expect(DEFAULT_BET_STAKE).toBe(10)
  })
})

describe("canPlaceBet", () => {
  const base = {
    nowMs: 1000,
    kickoffMs: 2000,
    matchStatus: "OPEN",
    userBalance: 100,
    stake: 50,
    existingBet: null,
  }

  it("allows valid pre-kickoff bets", () => {
    expect(canPlaceBet(base).ok).toBe(true)
  })

  it("blocks after kickoff", () => {
    expect(canPlaceBet({ ...base, nowMs: 2000 }).reason).toMatch(/locked/i)
  })

  it("blocks after kickoff has passed", () => {
    expect(canPlaceBet({ ...base, nowMs: 2001 }).reason).toMatch(/locked/i)
  })

  it("allows pending bet edits before kickoff", () => {
    expect(canPlaceBet({ ...base, existingBet: { stake: 40, status: "PENDING" } }).ok).toBe(true)
  })

  it("only requires balance for additional stake when editing", () => {
    expect(
      canPlaceBet({
        ...base,
        userBalance: 10,
        stake: 60,
        existingBet: { stake: 50, status: "PENDING" },
      }).ok,
    ).toBe(true)
  })

  it("blocks editing when the added stake exceeds balance", () => {
    expect(
      canPlaceBet({
        ...base,
        userBalance: 9,
        stake: 60,
        existingBet: { stake: 50, status: "PENDING" },
      }).reason,
    ).toMatch(/insufficient/i)
  })

  it("blocks edits to settled bets", () => {
    expect(canPlaceBet({ ...base, existingBet: { stake: 50, status: "WON" } }).reason).toMatch(/pending/i)
  })

  it("blocks insufficient balance", () => {
    expect(canPlaceBet({ ...base, userBalance: 10 }).reason).toMatch(/insufficient/i)
  })

  it("blocks non-open match statuses", () => {
    expect(canPlaceBet({ ...base, matchStatus: "LOCKED" }).reason).toMatch(/not open/i)
  })

  it("blocks matches whose teams are not confirmed", () => {
    expect(canPlaceBet({ ...base, teamsConfirmed: false }).reason).toMatch(/not confirmed/i)
  })
})

describe("canMatchAcceptNewBet", () => {
  const base = {
    nowMs: 1000,
    kickoffMs: 2000,
    matchStatus: "OPEN",
  }

  it("allows matches before kickoff", () => {
    expect(canMatchAcceptNewBet(base).ok).toBe(true)
  })

  it("blocks matches exactly at kickoff", () => {
    expect(canMatchAcceptNewBet({ ...base, nowMs: 2000 }).reason).toMatch(/locked/i)
  })

  it("blocks matches after kickoff", () => {
    expect(canMatchAcceptNewBet({ ...base, nowMs: 2001 }).reason).toMatch(/locked/i)
  })
})

describe("isMatchBettableForUser", () => {
  const base = {
    nowMs: 1000,
    kickoffMs: 2000,
    matchStatus: "OPEN",
    hasUserBet: false,
  }

  it("returns true for a pre-kickoff open match without a user bet", () => {
    expect(isMatchBettableForUser(base)).toBe(true)
  })

  it("returns true before kickoff when the user already has a pending bet to edit", () => {
    expect(isMatchBettableForUser({ ...base, hasUserBet: true })).toBe(true)
  })

  it("returns false at kickoff", () => {
    expect(isMatchBettableForUser({ ...base, nowMs: 2000 })).toBe(false)
  })
})
