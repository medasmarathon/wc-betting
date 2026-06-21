import { describe, expect, it } from "vitest"
import { calculatePayout, calculateResultPick, canPlaceBet } from "@/lib/betting"

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
