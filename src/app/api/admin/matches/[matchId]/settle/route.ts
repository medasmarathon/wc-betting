import { handleRouteError, requireAdmin } from "@/lib/auth"
import { settleMatch } from "@/lib/betting"

type RouteContext = {
  params: Promise<{ matchId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { matchId } = await context.params
    await settleMatch(matchId, admin)
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
