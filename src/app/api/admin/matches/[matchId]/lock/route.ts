import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"

type RouteContext = {
  params: Promise<{ matchId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { matchId } = await context.params
    const db = getAdminDb()
    await db.collection("matches").doc(matchId).update({
      status: "LOCKED",
      lockedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await db.collection("auditLogs").add({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "MATCH_LOCKED",
      entityType: "MATCH",
      entityId: matchId,
      createdAt: FieldValue.serverTimestamp(),
    })
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
