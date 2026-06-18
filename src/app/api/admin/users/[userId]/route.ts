import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { userId } = await context.params
    const input = (await request.json()) as { isActive?: boolean }
    if (typeof input.isActive !== "boolean") {
      return Response.json({ error: "isActive boolean is required" }, { status: 400 })
    }

    const db = getAdminDb()
    await db.collection("users").doc(userId).update({
      isActive: input.isActive,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await db.collection("auditLogs").add({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: input.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "USER",
      entityId: userId,
      after: { isActive: input.isActive },
      createdAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
