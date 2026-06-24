import { handleRouteError, requireUser } from "@/lib/auth"
import { placeBet } from "@/lib/betting"
import { normalizeLocale } from "@/lib/i18n"
import { placeBetSchema } from "@/lib/validation"

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const input = placeBetSchema.parse(await request.json())
    const result = await placeBet(user, { ...input, locale: normalizeLocale(request.headers.get("x-locale")) })
    return Response.json(result, { status: result.action === "updated" ? 200 : 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
