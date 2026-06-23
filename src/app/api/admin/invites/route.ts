import { FieldValue } from "firebase-admin/firestore"
import { emailKey, handleRouteError, HttpError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { inviteInputSchema } from "@/lib/validation"
import type { InviteDoc } from "@/types/betting"

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const input = inviteInputSchema.parse(await request.json())
    const db = getAdminDb()
    const inviteRef = db.collection("invites").doc(emailKey(input.email))

    const created = await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef)
      const existingInvite = inviteSnap.exists ? (inviteSnap.data() as InviteDoc) : undefined
      if (existingInvite?.acceptedBy) {
        throw new HttpError(409, "Invite has already been accepted")
      }

      const inviteDoc = {
        email: input.email,
        role: input.role,
        ...(input.displayName ? { displayName: input.displayName } : {}),
        createdAt: existingInvite?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.uid,
        ...(inviteSnap.exists ? {} : { createdBy: admin.uid }),
      }

      tx.set(inviteRef, inviteDoc, { merge: true })
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: inviteSnap.exists ? "INVITE_UPDATED" : "INVITE_CREATED",
        entityType: "INVITE",
        entityId: inviteRef.id,
        after: {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
        },
        createdAt: FieldValue.serverTimestamp(),
      })
      return !inviteSnap.exists
    })

    return Response.json({ id: inviteRef.id }, { status: created ? 201 : 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
