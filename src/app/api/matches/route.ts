import { handleRouteError, requireUser } from "@/lib/auth"
import { isMatchBettableForUser } from "@/lib/betting"
import { getAdminDb } from "@/lib/firebase/admin"
import { lockExpiredOpenMatches } from "@/lib/schedule-sync"
import { serializeBetDoc, serializeDoc } from "@/lib/serialize"
import type { BetDoc, MatchDoc } from "@/types/betting"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const db = getAdminDb()
    await lockExpiredOpenMatches()

    const url = new URL(request.url)
    const view = url.searchParams.get("view") ?? "all"
    const matchesSnap = await db.collection("matches").orderBy("kickoffAt", "asc").get()
    const userBetsSnap = await db.collection("bets").where("userId", "==", user.uid).get()
    const betsByMatch = new Map(userBetsSnap.docs.map((doc) => [(doc.data() as BetDoc).matchId, doc]))
    const now = Date.now()

    const matches = matchesSnap.docs
      .filter((doc) => {
        const data = doc.data() as MatchDoc
        if (view === "upcoming") return ["SCHEDULED", "OPEN"].includes(data.status)
        if (view === "locked") return ["LOCKED", "LIVE"].includes(data.status)
        if (view === "completed") return ["COMPLETED", "SETTLED", "VOIDED"].includes(data.status)
        return true
      })
      .map((doc) => {
        const data = doc.data() as MatchDoc
        const userBet = betsByMatch.get(doc.id)
        return {
          ...serializeDoc(doc.id, data),
          userBet: userBet ? serializeBetDoc(userBet.id, userBet.data() as BetDoc) : null,
          isBettable: isMatchBettableForUser({
            nowMs: now,
            kickoffMs: data.kickoffAt.toMillis?.() ?? 0,
            matchStatus: data.status,
            teamsConfirmed: data.teamsConfirmed,
            hasUserBet: Boolean(userBet),
          }),
        }
      })

    return Response.json({ matches })
  } catch (error) {
    return handleRouteError(error)
  }
}
