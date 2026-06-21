import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"
import type { BetDoc, MatchDoc } from "@/types/betting"

type RouteContext = {
  params: Promise<{ matchId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request)
    const { matchId } = await context.params
    const db = getAdminDb()
    const [matchSnap, betSnap] = await Promise.all([
      db.collection("matches").doc(matchId).get(),
      db.collection("bets").doc(`${matchId}_${user.uid}`).get(),
    ])

    if (!matchSnap.exists) {
      return Response.json({ error: "Match not found" }, { status: 404 })
    }

    const match = matchSnap.data() as MatchDoc
    const userBet = betSnap.exists ? (betSnap.data() as BetDoc) : null
    const now = Date.now()

    return Response.json({
      match: {
        ...serializeDoc(matchSnap.id, match),
        userBet: userBet ? serializeDoc(betSnap.id, userBet) : null,
        isBettable:
          match.teamsConfirmed !== false &&
          ["SCHEDULED", "OPEN"].includes(match.status) &&
          (match.kickoffAt.toMillis?.() ?? 0) > now &&
          !userBet,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
