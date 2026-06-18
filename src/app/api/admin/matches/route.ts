import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { matchInputSchema } from "@/lib/validation"

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const input = matchInputSchema.parse(await request.json())
    const db = getAdminDb()
    const matchRef = db.collection("matches").doc()
    const doc = {
      ...input,
      kickoffAt: Timestamp.fromDate(input.kickoffAt),
      betCount: 0,
      totalStaked: 0,
      createdBy: admin.uid,
      updatedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    await db.runTransaction(async (tx) => {
      tx.set(matchRef, doc)
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: "MATCH_CREATED",
        entityType: "MATCH",
        entityId: matchRef.id,
        after: { ...input, kickoffAt: input.kickoffAt.toISOString() },
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    return Response.json({ id: matchRef.id }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
