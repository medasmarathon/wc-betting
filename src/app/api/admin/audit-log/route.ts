import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const snap = await getAdminDb()
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
    return Response.json({ logs: snap.docs.map((doc) => serializeDoc(doc.id, doc.data())) })
  } catch (error) {
    return handleRouteError(error)
  }
}
