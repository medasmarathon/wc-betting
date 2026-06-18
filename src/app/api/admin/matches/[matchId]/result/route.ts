import { handleRouteError, requireAdmin } from "@/lib/auth"
import { enterResult } from "@/lib/betting"
import { resultInputSchema } from "@/lib/validation"

type RouteContext = {
  params: Promise<{ matchId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { matchId } = await context.params
    const input = resultInputSchema.parse(await request.json())
    await enterResult(matchId, admin, input)
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
