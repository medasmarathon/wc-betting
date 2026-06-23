import { describe, expect, it } from "vitest"
import {
  formatPickLabel,
  getFlagIconCode,
  getTeamInitials,
  teamsFromBet,
} from "@/lib/team-display"

const teams = {
  homeTeam: "Mexico",
  awayTeam: "South Africa",
  homeTeamCode: "MEX",
  awayTeamCode: "RSA",
}

describe("formatPickLabel", () => {
  it("maps HOME to the home team name", () => {
    expect(formatPickLabel("HOME", teams)).toBe("Mexico")
  })

  it("maps AWAY to the away team name", () => {
    expect(formatPickLabel("AWAY", teams)).toBe("South Africa")
  })

  it("maps DRAW to Draw", () => {
    expect(formatPickLabel("DRAW", teams)).toBe("Draw")
  })
})

describe("getFlagIconCode", () => {
  it("maps FIFA codes to flag-icons codes", () => {
    expect(getFlagIconCode("MEX")).toBe("mx")
    expect(getFlagIconCode("rsa")).toBe("za")
  })

  it("supports non-ISO United Kingdom team flags", () => {
    expect(getFlagIconCode("ENG")).toBe("gb-eng")
    expect(getFlagIconCode("SCO")).toBe("gb-sct")
  })

  it("falls back cleanly for missing or unknown codes", () => {
    expect(getFlagIconCode()).toBeUndefined()
    expect(getFlagIconCode("ZZZ")).toBeUndefined()
  })
})

describe("getTeamInitials", () => {
  it("creates readable initials when no flag is available", () => {
    expect(getTeamInitials("South Africa")).toBe("SA")
    expect(getTeamInitials("Brazil")).toBe("BRA")
  })
})

describe("teamsFromBet", () => {
  it("recovers team names from old bet match labels when explicit names are missing", () => {
    expect(teamsFromBet({ matchLabel: "Mexico vs South Africa" })).toMatchObject({
      homeTeam: "Mexico",
      awayTeam: "South Africa",
    })
  })
})
