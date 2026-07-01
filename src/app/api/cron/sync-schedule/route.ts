import { handleRouteError, requireAdmin } from "@/lib/auth"
import { claimScheduleSyncSlot } from "@/lib/schedule-sync-rate-limit"
import { runScheduleSyncMaintenance } from "@/lib/schedule-sync-maintenance"

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET
    const authorization = request.headers.get("authorization")
    const legacySecret = request.headers.get("x-cron-secret")
    const isCronAuthorized = Boolean(
      expected && (authorization === `Bearer ${expected}` || legacySecret === expected),
    )

    if (!isCronAuthorized) {
      await requireAdmin(request)
      const rateLimit = await claimScheduleSyncSlot()
      if (!rateLimit.allowed) {
        return Response.json(
          {
            error: "Schedule sync can only be triggered once per hour.",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
            nextAllowedAt: rateLimit.nextAllowedAt,
          },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(rateLimit.retryAfterSeconds),
            },
          },
        )
      }
    }

    return Response.json(await runScheduleSyncMaintenance(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleRouteError(error)
  }
}
