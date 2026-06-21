import { handleRouteError, requireUser } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import type { BetDoc } from "@/types/betting"

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const snap = await getAdminDb().collection("bets").where("status", "==", "LOST").get()
    const confirmedFundTotal = snap.docs.reduce((total, doc) => {
      const bet = doc.data() as Partial<BetDoc>
      return total + Number(bet.fundContribution ?? bet.stake ?? 0)
    }, 0)

    return Response.json({ confirmedFundTotal })
  } catch (error) {
    return handleRouteError(error)
  }
}
