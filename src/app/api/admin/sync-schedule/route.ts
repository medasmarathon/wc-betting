import { handleRouteError, requireAdmin } from "@/lib/auth"
import { runScheduleSyncMaintenance } from "@/lib/schedule-sync-maintenance"

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    return Response.json(await runScheduleSyncMaintenance(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleRouteError(error)
  }
}
