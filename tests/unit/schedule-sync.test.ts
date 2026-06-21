import { describe, expect, it } from "vitest"
import {
  buildMatchSyncDecision,
  mapWorldCupStage,
  normalizeWorldCupFixture,
} from "@/lib/schedule-sync"

const now = new Date("2026-06-01T00:00:00Z")

describe("mapWorldCupStage", () => {
  it.each([
    ["group-stage", 1, "GROUP"],
    ["round-of-32", 73, "ROUND_OF_32"],
    ["round-of-16", 89, "ROUND_OF_16"],
    ["quarter-finals", 97, "QUARTER_FINAL"],
    ["semi-finals", 101, "SEMI_FINAL"],
    ["third-place", 103, "THIRD_PLACE"],
    ["final", 104, "FINAL"],
  ])("maps %s to %s", (stage, matchNumber, expected) => {
    expect(mapWorldCupStage(stage, matchNumber)).toBe(expected)
  })
})

describe("normalizeWorldCupFixture", () => {
  it("normalizes ESPN group fixtures", () => {
    const fixture = normalizeWorldCupFixture(
      "espn",
      {
        id: "760415",
        date: "2026-06-11T19:00Z",
        season: { slug: "group-stage" },
        competitions: [
          {
            altGameNote: "FIFA World Cup, Group A",
            venue: { fullName: "Estadio Banorte", address: { city: "Mexico City" } },
            status: { type: { state: "pre", completed: false } },
            competitors: [
              {
                homeAway: "home",
                team: { displayName: "Mexico", abbreviation: "MEX" },
              },
              {
                homeAway: "away",
                team: { displayName: "South Africa", abbreviation: "RSA" },
              },
            ],
          },
        ],
      },
      1,
      now,
    )

    expect(fixture).toMatchObject({
      id: "wc2026-match-1",
      externalId: "espn:fifa.world:760415",
      source: "espn",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      homeTeamCode: "MEX",
      awayTeamCode: "RSA",
      groupName: "Group A",
      stage: "GROUP",
      status: "OPEN",
      venueName: "Estadio Banorte",
      hostCity: "Mexico City",
      teamsConfirmed: true,
    })
    expect(fixture.kickoffAt.toISOString()).toBe("2026-06-11T19:00:00.000Z")
  })

  it("normalizes ESPN completed fixtures with scores", () => {
    const fixture = normalizeWorldCupFixture(
      "espn",
      {
        id: "760500",
        date: "2026-06-20T19:00Z",
        season: { slug: "group-stage" },
        competitions: [
          {
            status: { type: { state: "post", completed: true } },
            competitors: [
              { homeAway: "home", score: "2", team: { displayName: "Brazil" } },
              { homeAway: "away", score: "1", team: { displayName: "Morocco" } },
            ],
          },
        ],
      },
      35,
      now,
    )

    expect(fixture.status).toBe("COMPLETED")
    expect(fixture.homeScore).toBe(2)
    expect(fixture.awayScore).toBe(1)
    expect(fixture.resultPick).toBe("HOME")
  })

  it("normalizes ESPN completed draws as final draws when no winner is provided", () => {
    const fixture = normalizeWorldCupFixture(
      "espn",
      {
        id: "760501",
        date: "2026-06-20T19:00Z",
        season: { slug: "group-stage" },
        competitions: [
          {
            status: { type: { state: "post", completed: true, shortDetail: "FT" } },
            competitors: [
              { homeAway: "home", score: "1", team: { displayName: "Brazil" } },
              { homeAway: "away", score: "1", team: { displayName: "Morocco" } },
            ],
          },
        ],
      },
      36,
      now,
    )

    expect(fixture.status).toBe("COMPLETED")
    expect(fixture.resultPick).toBe("DRAW")
    expect(fixture.resultSourceDetail).toBe("FT")
  })

  it("normalizes ESPN penalty finals to the official winner instead of a draw", () => {
    const fixture = normalizeWorldCupFixture(
      "espn",
      {
        id: "633850",
        date: "2026-07-19T19:00Z",
        season: { slug: "final" },
        competitions: [
          {
            status: {
              type: {
                state: "post",
                completed: true,
                name: "STATUS_FINAL_PEN",
                shortDetail: "FT-Pens",
              },
            },
            competitors: [
              {
                homeAway: "home",
                score: "3",
                winner: true,
                shootoutScore: 4,
                team: { displayName: "Argentina" },
              },
              {
                homeAway: "away",
                score: "3",
                winner: false,
                shootoutScore: 2,
                team: { displayName: "France" },
              },
            ],
          },
        ],
      },
      104,
      now,
    )

    expect(fixture.status).toBe("COMPLETED")
    expect(fixture.homeScore).toBe(3)
    expect(fixture.awayScore).toBe(3)
    expect(fixture.homeShootoutScore).toBe(4)
    expect(fixture.awayShootoutScore).toBe(2)
    expect(fixture.resultPick).toBe("HOME")
    expect(fixture.resultSourceDetail).toBe("FT-Pens")
  })

  it("normalizes fallback knockout placeholders as unconfirmed", () => {
    const fixture = normalizeWorldCupFixture(
      "thestatsapi",
      {
        matchNumber: 103,
        kickoffUtc: "2026-07-18T21:00:00Z",
        stage: "third-place",
        homeTeam: "Loser Match 101",
        awayTeam: "Loser Match 102",
        stadium: "Hard Rock Stadium",
        hostCity: "miami",
      },
      103,
      now,
    )

    expect(fixture).toMatchObject({
      id: "wc2026-match-103",
      externalId: "thestatsapi:wc2026:103",
      stage: "THIRD_PLACE",
      status: "SCHEDULED",
      teamsConfirmed: false,
      venueName: "Hard Rock Stadium",
      hostCity: "miami",
    })
  })
})

describe("buildMatchSyncDecision", () => {
  const fixture = normalizeWorldCupFixture(
    "thestatsapi",
    {
      matchNumber: 1,
      kickoffUtc: "2026-06-11T19:00:00Z",
      stage: "group-stage",
      group: "A",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
    },
    1,
    now,
  )

  it("creates missing matches", () => {
    const decision = buildMatchSyncDecision(fixture, undefined, now.getTime())
    expect(decision.operation).toBe("create")
    if (decision.operation !== "create") throw new Error("Expected create decision")
    expect(decision.data).toMatchObject({
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      odds: { HOME: 2, DRAW: 3, AWAY: 2 },
      betCount: 0,
      totalStaked: 0,
    })
  })

  it("updates schedule fields before kickoff", () => {
    const decision = buildMatchSyncDecision(
      { ...fixture, homeTeam: "Updated Mexico" },
      { status: "OPEN", kickoffAt: { toMillis: () => Date.parse("2026-06-11T19:00:00Z") } },
      now.getTime(),
    )

    expect(decision.operation).toBe("update")
    if (decision.operation !== "update") throw new Error("Expected update decision")
    expect(decision.data).toMatchObject({ homeTeam: "Updated Mexico", status: "OPEN" })
  })

  it("does not update terminal matches", () => {
    const decision = buildMatchSyncDecision(
      fixture,
      { status: "SETTLED", kickoffAt: { toMillis: () => Date.parse("2026-06-11T19:00:00Z") } },
      now.getTime(),
    )

    expect(decision.operation).toBe("skip")
  })

  it("does not overwrite teams after kickoff", () => {
    const decision = buildMatchSyncDecision(
      { ...fixture, homeTeam: "Changed Team" },
      { status: "LOCKED", kickoffAt: { toMillis: () => Date.parse("2026-06-11T19:00:00Z") } },
      Date.parse("2026-06-12T00:00:00Z"),
    )

    expect(decision.operation).toBe("update")
    if (decision.operation !== "update") throw new Error("Expected update decision")
    expect(decision.data.homeTeam).toBeUndefined()
  })

  it("does not mark a completed source fixture completed without scores", () => {
    const decision = buildMatchSyncDecision(
      { ...fixture, status: "COMPLETED", homeScore: undefined, awayScore: undefined },
      { status: "LOCKED", kickoffAt: { toMillis: () => Date.parse("2026-06-11T19:00:00Z") } },
      Date.parse("2026-06-12T00:00:00Z"),
    )

    expect(decision.operation).toBe("update")
    if (decision.operation !== "update") throw new Error("Expected update decision")
    expect(decision.data.status).toBeUndefined()
  })
})
