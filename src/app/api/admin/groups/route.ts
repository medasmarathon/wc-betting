import { FieldValue } from "firebase-admin/firestore"
import { handleRouteError, requireAdmin } from "@/lib/auth"
import { getAdminDb } from "@/lib/firebase/admin"
import { serializeDoc } from "@/lib/serialize"
import { groupInputSchema } from "@/lib/validation"
import type { BetDoc, LeaderboardDoc, UserDoc } from "@/types/betting"

type GroupMetrics = {
  memberCount: number
  fundTotal: number
  balance: number
  netProfit: number
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalPayout: number
  members: GroupMemberPerformance[]
}

type GroupMemberPerformance = {
  id: string
  email: string
  displayName: string
  isActive: boolean
  balance: number
  netProfit: number
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalPayout: number
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const db = getAdminDb()
    const [groupsSnap, usersSnap, leaderboardSnap, lostBetsSnap] = await Promise.all([
      db.collection("groups").orderBy("name").get(),
      db.collection("users").get(),
      db.collection("leaderboard").get(),
      db.collection("bets").where("status", "==", "LOST").get(),
    ])
    const groupIds = new Set(groupsSnap.docs.map((doc) => doc.id))
    const userGroupIds = new Map<string, string>()
    const leaderboardByUserId = new Map<string, Partial<LeaderboardDoc>>(
      leaderboardSnap.docs.map((doc) => [doc.id, doc.data() as Partial<LeaderboardDoc>]),
    )
    const metricsByGroupId = new Map<string, GroupMetrics>()

    for (const groupId of groupIds) {
      metricsByGroupId.set(groupId, {
        memberCount: 0,
        fundTotal: 0,
        balance: 0,
        netProfit: 0,
        totalBets: 0,
        wonBets: 0,
        lostBets: 0,
        pendingBets: 0,
        totalStaked: 0,
        totalPayout: 0,
        members: [],
      })
    }

    for (const doc of usersSnap.docs) {
      const user = doc.data() as UserDoc
      if (!user.groupId || !groupIds.has(user.groupId)) continue

      userGroupIds.set(doc.id, user.groupId)

      const groupMetrics = metricsByGroupId.get(user.groupId)
      if (!groupMetrics) continue

      const leaderboard = leaderboardByUserId.get(doc.id)
      const balance = Number(leaderboard?.balance ?? user.balance ?? 0)
      const netProfit = Number(leaderboard?.netProfit ?? balance - Number(user.startingBalance ?? 0))
      const totalBets = Number(leaderboard?.totalBets ?? 0)
      const wonBets = Number(leaderboard?.wonBets ?? 0)
      const lostBets = Number(leaderboard?.lostBets ?? 0)
      const pendingBets = Number(leaderboard?.pendingBets ?? 0)
      const totalStaked = Number(leaderboard?.totalStaked ?? 0)
      const totalPayout = Number(leaderboard?.totalPayout ?? 0)

      groupMetrics.memberCount += 1
      groupMetrics.balance += balance
      groupMetrics.netProfit += netProfit
      groupMetrics.totalBets += totalBets
      groupMetrics.wonBets += wonBets
      groupMetrics.lostBets += lostBets
      groupMetrics.pendingBets += pendingBets
      groupMetrics.totalStaked += totalStaked
      groupMetrics.totalPayout += totalPayout
      groupMetrics.members.push({
        id: doc.id,
        email: user.email,
        displayName: user.displayName,
        isActive: user.isActive,
        balance,
        netProfit,
        totalBets,
        wonBets,
        lostBets,
        pendingBets,
        totalStaked,
        totalPayout,
      })
    }

    for (const doc of lostBetsSnap.docs) {
      const bet = doc.data() as Partial<BetDoc>
      const groupId = bet.groupId ?? userGroupIds.get(String(bet.userId ?? ""))
      if (!groupId) continue

      const groupMetrics = metricsByGroupId.get(groupId)
      if (!groupMetrics) continue

      groupMetrics.fundTotal += Number(bet.fundContribution ?? bet.stake ?? 0)
    }

    for (const groupMetrics of metricsByGroupId.values()) {
      groupMetrics.members.sort((a, b) => b.balance - a.balance || a.displayName.localeCompare(b.displayName))
    }

    const groups = groupsSnap.docs.map((doc) => ({
      ...serializeDoc(doc.id, doc.data()),
      ...metricsByGroupId.get(doc.id),
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
