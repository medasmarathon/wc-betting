import { describe, expect, it } from "vitest"
import { serializeBetDoc } from "@/lib/serialize"
import type { BetDoc } from "@/types/betting"

describe("serializeBetDoc", () => {
  it("drops legacy score prediction fields from bet responses", () => {
    const serialized = serializeBetDoc("bet-1", {
      userId: "user-1",
      userEmail: "friend@example.com",
      userDisplayName: "Friend",
      matchId: "match-1",
      matchLabel: "Mexico vs South Africa",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      kickoffAt: "2026-06-11T19:00:00.000Z",
      pick: "HOME",
      stake: 10,
      potentialPayout: 10,
      fundContribution: 0,
      status: "PENDING",
      payout: 0,
      placedAt: "2026-06-10T19:00:00.000Z",
      updatedAt: "2026-06-10T19:00:00.000Z",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    } as BetDoc & { predictedHomeScore: number; predictedAwayScore: number })

    expect(serialized).not.toHaveProperty("predictedHomeScore")
    expect(serialized).not.toHaveProperty("predictedAwayScore")
  })
})
