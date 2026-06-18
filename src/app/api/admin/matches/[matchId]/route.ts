import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { matchInputSchema } from "@/lib/validation"

type RouteContext = {
  params: Promise<{ matchId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { matchId } = await context.params
    const input = matchInputSchema.partial().parse(await request.json())
    const db = getAdminDb()
    const matchRef = db.collection("matches").doc(matchId)

    await db.runTransaction(async (tx) => {
      const before = await tx.get(matchRef)
      if (!before.exists) throw new Error("Match not found")
      const update = {
        ...input,
        ...(input.kickoffAt ? { kickoffAt: Timestamp.fromDate(input.kickoffAt) } : {}),
        updatedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }
      tx.update(matchRef, update)
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: "MATCH_UPDATED",
        entityType: "MATCH",
        entityId: matchId,
        before: before.data(),
        after: { ...input, kickoffAt: input.kickoffAt?.toISOString() },
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
