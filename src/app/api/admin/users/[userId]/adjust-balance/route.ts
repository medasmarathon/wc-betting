import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { adjustBalanceSchema } from "@/lib/validation"
import type { UserDoc } from "@/types/betting"

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    const { userId } = await context.params
    const input = adjustBalanceSchema.parse(await request.json())
    const db = getAdminDb()
    const userRef = db.collection("users").doc(userId)

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists) throw new Error("User not found")
      const user = userSnap.data() as UserDoc
      const balanceAfter = user.balance + input.amount
      if (balanceAfter < 0) throw new Error("Adjustment would make balance negative")

      tx.update(userRef, { balance: balanceAfter, updatedAt: FieldValue.serverTimestamp() })
      tx.set(db.collection("walletTransactions").doc(), {
        userId,
        userDisplayName: user.displayName,
        type: "ADMIN_ADJUSTMENT",
        amount: input.amount,
        balanceAfter,
        description: input.reason,
        createdBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
      })
      tx.set(
        db.collection("leaderboard").doc(userId),
        {
          userId,
          displayName: user.displayName,
          balance: balanceAfter,
          netProfit: balanceAfter - user.startingBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: "ADMIN_BALANCE_ADJUSTED",
        entityType: "WALLET",
        entityId: userId,
        before: { balance: user.balance },
        after: { amount: input.amount, balanceAfter, reason: input.reason },
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
