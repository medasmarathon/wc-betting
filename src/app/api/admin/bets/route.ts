import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeBetDoc } from "@/lib/serialize"
import type { BetDoc, MatchDoc } from "@/types/betting"

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    const db = getAdminDb()
    const snap = await db.collection("bets").orderBy("placedAt", "desc").get()
    const matchIds = Array.from(new Set(snap.docs.map((doc) => String(doc.data().matchId)).filter(Boolean)))
    const matchSnaps = matchIds.length
      ? await db.getAll(...matchIds.map((matchId) => db.collection("matches").doc(matchId)))
      : []
    const matchesById = new Map(matchSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data() as MatchDoc]))

    const bets = snap.docs.map((doc) => {
      const data = doc.data() as BetDoc
      const match = matchesById.get(String(data.matchId))

      return {
        ...serializeBetDoc(doc.id, data),
        homeTeamCode: match?.homeTeamCode ?? data.homeTeamCode,
        awayTeamCode: match?.awayTeamCode ?? data.awayTeamCode,
        matchStatus: match?.status,
        homeScore: match?.homeScore,
        awayScore: match?.awayScore,
        resultPick: match?.resultPick,
      }
    })

    return Response.json({ bets })
  } catch (error) {
    return handleRouteError(error)
  }
}
