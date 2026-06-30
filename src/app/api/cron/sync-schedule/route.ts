import {
  applyAutomaticMissingBetLossesForExpiredMatches,
  normalizePendingBetStakesForConfiguredMatches,
  resetInvalidSettledBets,
  settleCompletedMatches,
} from "@/lib/betting"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { claimScheduleSyncSlot } from "@/lib/schedule-sync-rate-limit"
import { lockExpiredOpenMatches, syncWorldCupSchedule } from "@/lib/schedule-sync"

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

    const sync = await syncWorldCupSchedule()
    const locked = await lockExpiredOpenMatches()
    const normalizedStakes = await normalizePendingBetStakesForConfiguredMatches()
    const repairedBets = await resetInvalidSettledBets()
    const automaticLosses = await applyAutomaticMissingBetLossesForExpiredMatches()
    const settlement = await settleCompletedMatches()

    return Response.json(
      { sync, locked, normalizedStakes, repairedBets, automaticLosses, settlement },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
