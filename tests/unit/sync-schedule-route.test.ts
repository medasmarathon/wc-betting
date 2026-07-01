import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const maintenanceResult = {
    sync: { source: "espn", created: 0, updated: 1, skipped: 0, failed: 0 },
    locked: 0,
    normalizedStakes: { adjusted: 0, skipped: 0, failed: 0 },
    repairedBets: { repaired: 0, failed: 0 },
    automaticLosses: { applied: 0, skipped: 0, failed: 0 },
    settlement: { settled: 1, updated: 0, skipped: 0, failed: 0 },
  }

  return {
    maintenanceResult,
    claimScheduleSyncSlot: vi.fn(),
    requireAdmin: vi.fn(),
    runScheduleSyncMaintenance: vi.fn(async () => maintenanceResult),
    runScheduleSyncMaintenanceStep: vi.fn(async (step: string) => ({ step, sync: maintenanceResult.sync })),
  }
})

vi.mock("@/lib/auth", () => ({
  handleRouteError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: typeof error === "object" && error && "status" in error ? Number(error.status) : 500 },
    ),
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message)
    }
  },
  requireAdmin: mocks.requireAdmin,
}))

vi.mock("@/lib/schedule-sync-rate-limit", () => ({
  claimScheduleSyncSlot: mocks.claimScheduleSyncSlot,
}))

vi.mock("@/lib/schedule-sync-maintenance", () => ({
  SCHEDULE_SYNC_MAINTENANCE_STEPS: [
    "sync",
    "lock",
    "normalize-stakes",
    "repair-bets",
    "automatic-losses",
    "settle",
  ],
  runScheduleSyncMaintenance: mocks.runScheduleSyncMaintenance,
  runScheduleSyncMaintenanceStep: mocks.runScheduleSyncMaintenanceStep,
}))

describe("sync schedule cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret"
    vi.clearAllMocks()
  })

  it("runs maintenance for authorized cron requests without consuming the manual rate limit", async () => {
    const { GET } = await import("@/app/api/cron/sync-schedule/route")

    const response = await GET(
      new Request("http://localhost/api/cron/sync-schedule", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    )
    const json = await response.json()

    expect(response.ok).toBe(true)
    expect(json).toEqual(mocks.maintenanceResult)
    expect(mocks.requireAdmin).not.toHaveBeenCalled()
    expect(mocks.claimScheduleSyncSlot).not.toHaveBeenCalled()
    expect(mocks.runScheduleSyncMaintenance).toHaveBeenCalledTimes(1)
  })

  it("rate limits admin calls to the cron route", async () => {
    mocks.claimScheduleSyncSlot.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 120,
      nextAllowedAt: "2026-06-01T01:00:00.000Z",
    })
    const { GET } = await import("@/app/api/cron/sync-schedule/route")

    const response = await GET(new Request("http://localhost/api/cron/sync-schedule"))
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("120")
    expect(json).toEqual({
      error: "Schedule sync can only be triggered once per hour.",
      retryAfterSeconds: 120,
      nextAllowedAt: "2026-06-01T01:00:00.000Z",
    })
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1)
    expect(mocks.runScheduleSyncMaintenance).not.toHaveBeenCalled()
  })
})

describe("admin sync schedule route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs the first maintenance step by default without claiming a cron rate-limit slot", async () => {
    const { POST } = await import("@/app/api/admin/sync-schedule/route")

    const response = await POST(new Request("http://localhost/api/admin/sync-schedule", { method: "POST" }))
    const json = await response.json()

    expect(response.ok).toBe(true)
    expect(json).toEqual({ step: "sync", sync: mocks.maintenanceResult.sync })
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1)
    expect(mocks.claimScheduleSyncSlot).not.toHaveBeenCalled()
    expect(mocks.runScheduleSyncMaintenanceStep).toHaveBeenCalledWith("sync", undefined, {
      userId: undefined,
      matchIds: undefined,
      finalize: false,
    })
  })

  it("runs requested non-user-scoped maintenance steps", async () => {
    const { POST } = await import("@/app/api/admin/sync-schedule/route")

    const response = await POST(
      new Request("http://localhost/api/admin/sync-schedule?step=lock", { method: "POST" }),
    )
    const json = await response.json()

    expect(response.ok).toBe(true)
    expect(json).toEqual({ step: "lock", sync: mocks.maintenanceResult.sync })
    expect(mocks.runScheduleSyncMaintenanceStep).toHaveBeenCalledWith("lock", undefined, {
      userId: undefined,
      matchIds: undefined,
      finalize: false,
    })
  })

  it("rejects user-scoped maintenance steps without a user id", async () => {
    const { POST } = await import("@/app/api/admin/sync-schedule/route")

    const response = await POST(
      new Request("http://localhost/api/admin/sync-schedule?step=settle", { method: "POST" }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: "settle requires userId" })
    expect(mocks.runScheduleSyncMaintenanceStep).not.toHaveBeenCalled()
  })

  it("passes user-scoped step options from the request body", async () => {
    const { POST } = await import("@/app/api/admin/sync-schedule/route")

    const response = await POST(
      new Request("http://localhost/api/admin/sync-schedule?step=repair-bets", {
        method: "POST",
        body: JSON.stringify({ userId: "user-1", matchIds: ["match-1"], finalize: true }),
      }),
    )

    expect(response.ok).toBe(true)
    expect(mocks.runScheduleSyncMaintenanceStep).toHaveBeenCalledWith("repair-bets", undefined, {
      userId: "user-1",
      matchIds: ["match-1"],
      finalize: true,
    })
  })

  it("rejects invalid maintenance steps", async () => {
    const { POST } = await import("@/app/api/admin/sync-schedule/route")

    const response = await POST(
      new Request("http://localhost/api/admin/sync-schedule?step=unknown", { method: "POST" }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: "Invalid schedule sync step" })
    expect(mocks.runScheduleSyncMaintenanceStep).not.toHaveBeenCalled()
  })
})
