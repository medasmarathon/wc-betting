import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, HttpError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { groupInputSchema } from "@/lib/validation"

type RouteContext = {
  params: Promise<{ groupId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { groupId } = await context.params
    const input = groupInputSchema.parse(await request.json())
    const db = getAdminDb()
    const groupRef = db.collection("groups").doc(groupId)
    const [groupSnap, usersSnap] = await Promise.all([
      groupRef.get(),
      db.collection("users").where("groupId", "==", groupId).get(),
    ])

    if (!groupSnap.exists) throw new HttpError(404, "Group not found")

    const batch = db.batch()
    batch.update(groupRef, {
      name: input.name,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    for (const userSnap of usersSnap.docs) {
      batch.update(userSnap.ref, {
        groupName: input.name,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    batch.set(db.collection("auditLogs").doc(), {
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "GROUP_UPDATED",
      entityType: "GROUP",
      entityId: groupId,
      before: { name: groupSnap.data()?.name },
      after: { name: input.name, updatedUsers: usersSnap.size },
      createdAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
