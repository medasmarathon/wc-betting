import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import type { BetDoc } from "@/types/betting"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const db = getAdminDb()
    const snap = await db.collection("bets").where("status", "==", "LOST").get()
    const confirmedFundTotal = snap.docs.reduce((total, doc) => {
      const bet = doc.data() as Partial<BetDoc>
      return total + Number(bet.fundContribution ?? bet.stake ?? 0)
    }, 0)
    const groupUserIds = new Set<string>()

    if (user.groupId) {
      const groupUsersSnap = await db.collection("users").where("groupId", "==", user.groupId).get()
      for (const doc of groupUsersSnap.docs) groupUserIds.add(doc.id)
    }

    const groupFundTotal = user.groupId
      ? snap.docs.reduce((total, doc) => {
          const bet = doc.data() as Partial<BetDoc>
          const belongsToGroup = bet.groupId ? bet.groupId === user.groupId : groupUserIds.has(String(bet.userId))
          if (!belongsToGroup) return total
          return total + Number(bet.fundContribution ?? bet.stake ?? 0)
        }, 0)
      : undefined

    return Response.json({
      confirmedFundTotal,
      ...(user.groupId
        ? {
            groupFundTotal,
            userGroup: {
              id: user.groupId,
              name: user.groupName ?? "Group",
            },
          }
        : {}),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
