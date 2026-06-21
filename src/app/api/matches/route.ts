import { handleRouteError, requireUser } from "@/lib/auth"
import { isMatchBettableForUser } from "@/lib/betting"
import { getAdminDb } from "@/lib/firebase/admin"
import { lockExpiredOpenMatches } from "@/lib/schedule-sync"
import { serializeDoc } from "@/lib/serialize"
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
        return {
          ...serializeDoc(doc.id, data),
          userBet: betsByMatch.has(doc.id)
            ? serializeDoc(betsByMatch.get(doc.id)!.id, betsByMatch.get(doc.id)!.data())
            : null,
          isBettable: isMatchBettableForUser({
            nowMs: now,
            kickoffMs: data.kickoffAt.toMillis?.() ?? 0,
            matchStatus: data.status,
            teamsConfirmed: data.teamsConfirmed,
            hasUserBet: betsByMatch.has(doc.id),
          }),
        }
      })

    return Response.json({ matches })
  } catch (error) {
    return handleRouteError(error)
  }
}
