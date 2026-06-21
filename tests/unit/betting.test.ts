import { describe, expect, it } from "vitest"
import {
  calculateFinalResultPick,
  calculatePayout,
  calculateResultPick,
  canMatchAcceptNewBet,
  canPlaceBet,
  isMatchBettableForUser,
} from "@/lib/betting"

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
  it("multiplies stake by stored odds", () => {
    expect(calculatePayout(50, 2.5)).toBe(125)
  })
})

describe("canPlaceBet", () => {
  const base = {
    nowMs: 1000,
    kickoffMs: 2000,
    matchStatus: "OPEN",
    userBalance: 100,
    stake: 50,
    existingBet: false,
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

  it("blocks duplicate bets", () => {
    expect(canPlaceBet({ ...base, existingBet: true }).reason).toMatch(/already/i)
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

  it("returns false when the user already has a bet", () => {
    expect(isMatchBettableForUser({ ...base, hasUserBet: true })).toBe(false)
  })

  it("returns false at kickoff", () => {
    expect(isMatchBettableForUser({ ...base, nowMs: 2000 })).toBe(false)
  })
})
