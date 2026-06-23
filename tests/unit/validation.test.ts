import { describe, expect, it } from "vitest"
import { inviteInputSchema } from "@/lib/validation"

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
