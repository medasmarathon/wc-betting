import { handleRouteError, HttpError, requireAdmin } from "@/lib/auth"
import {
  SCHEDULE_SYNC_MAINTENANCE_STEPS,
  runScheduleSyncMaintenanceStep,
  type ScheduleSyncMaintenanceStep,
} from "@/lib/schedule-sync-maintenance"

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const step = getScheduleSyncStep(request)
    const options = await getScheduleSyncStepOptions(request)
    if (isUserScopedStep(step) && !options.userId) {
      throw new HttpError(400, `${step} requires userId`)
    }

    return Response.json(await runScheduleSyncMaintenanceStep(step, undefined, options), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

function getScheduleSyncStep(request: Request): ScheduleSyncMaintenanceStep {
  const step = new URL(request.url).searchParams.get("step") ?? SCHEDULE_SYNC_MAINTENANCE_STEPS[0]
  if (isScheduleSyncStep(step)) return step
  throw new HttpError(400, "Invalid schedule sync step")
}

function isScheduleSyncStep(step: string): step is ScheduleSyncMaintenanceStep {
  return SCHEDULE_SYNC_MAINTENANCE_STEPS.includes(step as ScheduleSyncMaintenanceStep)
}

function isUserScopedStep(step: ScheduleSyncMaintenanceStep) {
  return !["sync", "lock"].includes(step)
}

async function getScheduleSyncStepOptions(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body || typeof body !== "object") return {}

  return {
    userId: typeof body.userId === "string" ? body.userId : undefined,
    matchIds: Array.isArray(body.matchIds)
      ? body.matchIds.filter((matchId: unknown) => typeof matchId === "string")
      : undefined,
    finalize: body.finalize === true,
  }
}
