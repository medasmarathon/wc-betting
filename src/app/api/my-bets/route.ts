import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"
import type { MatchDoc } from "@/types/betting"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    let query: FirebaseFirestore.Query = getAdminDb()
      .collection("bets")
      .where("userId", "==", user.uid)
      .orderBy("placedAt", "desc")

    if (status && status !== "ALL") {
      query = query.where("status", "==", status)
    }

    const snap = await query.get()
    const db = getAdminDb()
    const matchIds = Array.from(new Set(snap.docs.map((doc) => String(doc.data().matchId)).filter(Boolean)))
    const matchSnaps = matchIds.length
      ? await db.getAll(...matchIds.map((matchId) => db.collection("matches").doc(matchId)))
      : []
    const matchesById = new Map(matchSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data() as MatchDoc]))

    const bets = snap.docs.map((doc) => {
      const data = doc.data()
      const match = matchesById.get(String(data.matchId))
      return {
        ...serializeDoc(doc.id, data),
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
