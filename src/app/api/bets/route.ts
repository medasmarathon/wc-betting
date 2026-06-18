import { handleRouteError, requireUser } from "@/lib/auth"
import { placeBet } from "@/lib/betting"
import { placeBetSchema } from "@/lib/validation"

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const input = placeBetSchema.parse(await request.json())
    const result = await placeBet(user, input)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
