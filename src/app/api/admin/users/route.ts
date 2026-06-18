import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const snap = await getAdminDb().collection("users").orderBy("displayName").get()
    return Response.json({ users: snap.docs.map((doc) => serializeDoc(doc.id, doc.data())) })
  } catch (error) {
    return handleRouteError(error)
  }
}
