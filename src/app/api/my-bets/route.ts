import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"

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
    return Response.json({ bets: snap.docs.map((doc) => serializeDoc(doc.id, doc.data())) })
  } catch (error) {
    return handleRouteError(error)
  }
}
