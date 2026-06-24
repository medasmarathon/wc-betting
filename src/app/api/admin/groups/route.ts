import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"
import { groupInputSchema } from "@/lib/validation"

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const db = getAdminDb()
    const [groupsSnap, usersSnap] = await Promise.all([
      db.collection("groups").orderBy("name").get(),
      db.collection("users").get(),
    ])
    const memberCounts = new Map<string, number>()

    for (const doc of usersSnap.docs) {
      const groupId = doc.data().groupId
      if (typeof groupId === "string" && groupId) {
        memberCounts.set(groupId, (memberCounts.get(groupId) ?? 0) + 1)
      }
    }

    const groups = groupsSnap.docs.map((doc) => ({
      ...serializeDoc(doc.id, doc.data()),
      memberCount: memberCounts.get(doc.id) ?? 0,
    }))

    return Response.json({ groups })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const input = groupInputSchema.parse(await request.json())
    const db = getAdminDb()
    const groupRef = db.collection("groups").doc()

    await groupRef.set({
      name: input.name,
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await db.collection("auditLogs").add({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "GROUP_CREATED",
      entityType: "GROUP",
      entityId: groupRef.id,
      after: { name: input.name },
      createdAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ id: groupRef.id }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
