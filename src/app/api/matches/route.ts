import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
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
          isBettable:
            data.teamsConfirmed !== false &&
            ["SCHEDULED", "OPEN"].includes(data.status) &&
            (data.kickoffAt.toMillis?.() ?? 0) > now &&
            !betsByMatch.has(doc.id),
        }
      })

    return Response.json({ matches })
  } catch (error) {
    return handleRouteError(error)
  }
}

async function lockExpiredOpenMatches() {
  const db = getAdminDb()
  const snap = await db
    .collection("matches")
    .where("status", "in", ["SCHEDULED", "OPEN"])
    .where("kickoffAt", "<=", new Date())
    .get()

  if (snap.empty) return
  const batch = db.batch()
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "LOCKED",
      lockedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  await batch.commit()
}
