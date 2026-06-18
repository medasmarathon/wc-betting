import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const snap = await getAdminDb().collection("leaderboard").orderBy("balance", "desc").get()
    return Response.json({ leaderboard: snap.docs.map((doc) => serializeDoc(doc.id, doc.data())) })
  } catch (error) {
    return handleRouteError(error)
  }
}
