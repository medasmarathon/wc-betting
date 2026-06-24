import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, HttpError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { userId } = await context.params
    const input = (await request.json()) as { isActive?: boolean; groupId?: string | null }
    const hasIsActive = typeof input.isActive === "boolean"
    const hasGroupId = Object.prototype.hasOwnProperty.call(input, "groupId")
    if (!hasIsActive && !hasGroupId) {
      return Response.json({ error: "No user changes provided" }, { status: 400 })
    }

    const db = getAdminDb()
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }
    let groupName: string | undefined

    if (hasIsActive) updates.isActive = input.isActive
    if (hasGroupId) {
      if (input.groupId) {
        const groupSnap = await db.collection("groups").doc(input.groupId).get()
        if (!groupSnap.exists) throw new HttpError(404, "Group not found")
        groupName = String(groupSnap.data()?.name ?? "")
        updates.groupId = input.groupId
        updates.groupName = groupName
      } else {
        updates.groupId = FieldValue.delete()
        updates.groupName = FieldValue.delete()
      }
    }

    await db.collection("users").doc(userId).update(updates)
    await db.collection("auditLogs").add({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: hasIsActive && !hasGroupId ? (input.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED") : "USER_UPDATED",
      entityType: "USER",
      entityId: userId,
      after: {
        ...(hasIsActive ? { isActive: input.isActive } : {}),
        ...(hasGroupId ? { groupId: input.groupId ?? null, groupName: groupName ?? null } : {}),
      },
      createdAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
