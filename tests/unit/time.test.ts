import { describe, expect, it } from "vitest"
import { addDaysToLocalDateKey, formatKickoff, getLocalDateKey } from "@/lib/time"

describe("time helpers", () => {
  it("builds local date keys from the runtime local calendar day", () => {
    const kickoff = new Date("2026-06-23T18:30:00.000Z")
    const expectedMonth = String(kickoff.getMonth() + 1).padStart(2, "0")
    const expectedDay = String(kickoff.getDate()).padStart(2, "0")

    expect(getLocalDateKey(kickoff)).toBe(`${kickoff.getFullYear()}-${expectedMonth}-${expectedDay}`)
  })

  it("steps local date keys by calendar day", () => {
    expect(addDaysToLocalDateKey("2026-06-30", 1)).toBe("2026-07-01")
    expect(addDaysToLocalDateKey("2026-07-01", -1)).toBe("2026-06-30")
  })

  it("formats kickoff with the local timezone label", () => {
    const kickoff = "2026-06-23T18:30:00.000Z"
    const expected = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(kickoff))

    expect(formatKickoff(kickoff)).toBe(expected)
  })
})
