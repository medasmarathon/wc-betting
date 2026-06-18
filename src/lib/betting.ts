import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import type { AuthedUser } from "@/lib/auth"
import { HttpError } from "@/lib/auth"
import type { BetDoc, BetPick, MatchDoc, UserDoc } from "@/types/betting"

export type PlaceBetInput = {
  matchId: string
  pick: BetPick
  stake: number
  predictedHomeScore?: number
  predictedAwayScore?: number
}

export function calculateResultPick(homeScore: number, awayScore: number): BetPick {
  if (homeScore > awayScore) return "HOME"
  if (homeScore < awayScore) return "AWAY"
  return "DRAW"
}

export function calculatePayout(stake: number, odds: number) {
  return Math.round(stake * odds)
}

export function canPlaceBet(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  userBalance: number
  stake: number
  existingBet: boolean
}) {
  if (params.existingBet) return { ok: false, reason: "You already placed a bet on this match" }
  if (params.nowMs >= params.kickoffMs) return { ok: false, reason: "Betting is locked for this match" }
  if (!["SCHEDULED", "OPEN"].includes(params.matchStatus)) {
    return { ok: false, reason: "This match is not open for betting" }
  }
  if (params.userBalance < params.stake) return { ok: false, reason: "Insufficient balance" }
  return { ok: true, reason: undefined }
}

export async function placeBet(user: AuthedUser, input: PlaceBetInput) {
  const db = getAdminDb()
  const userRef = db.collection("users").doc(user.uid)
  const matchRef = db.collection("matches").doc(input.matchId)
  const betId = `${input.matchId}_${user.uid}`
  const betRef = db.collection("bets").doc(betId)
  const stakeTxRef = db.collection("walletTransactions").doc(`stake_${betId}`)
  const leaderboardRef = db.collection("leaderboard").doc(user.uid)
  const auditRef = db.collection("auditLogs").doc()

  await db.runTransaction(async (tx) => {
    const [userSnap, matchSnap, existingBet] = await Promise.all([
      tx.get(userRef),
      tx.get(matchRef),
      tx.get(betRef),
    ])

    if (!userSnap.exists) throw new HttpError(404, "User profile not found")
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const userDoc = userSnap.data() as UserDoc
    const match = matchSnap.data() as MatchDoc
    const kickoffMs = match.kickoffAt.toMillis?.() ?? 0
    const nowMs = Date.now()
    const allowed = canPlaceBet({
      nowMs,
      kickoffMs,
      matchStatus: match.status,
      userBalance: userDoc.balance,
      stake: input.stake,
      existingBet: existingBet.exists,
    })

    if (!allowed.ok) throw new HttpError(400, allowed.reason ?? "Bet is not allowed")
    if (!userDoc.isActive) throw new HttpError(403, "User is inactive")

    const odds = match.odds[input.pick]
    const potentialPayout = calculatePayout(input.stake, odds)
    const newBalance = userDoc.balance - input.stake
    const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`

    const betDoc: BetDoc = {
      userId: user.uid,
      userEmail: user.email,
      userDisplayName: user.displayName,
      matchId: input.matchId,
      matchLabel,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffAt: match.kickoffAt,
      pick: input.pick,
      stake: input.stake,
      odds,
      potentialPayout,
      ...(input.predictedHomeScore === undefined
        ? {}
        : { predictedHomeScore: input.predictedHomeScore }),
      ...(input.predictedAwayScore === undefined
        ? {}
        : { predictedAwayScore: input.predictedAwayScore }),
      status: "PENDING",
      payout: 0,
      placedAt: Timestamp.fromMillis(nowMs),
    }

    tx.set(betRef, betDoc)
    tx.update(userRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() })
    tx.update(matchRef, {
      betCount: FieldValue.increment(1),
      totalStaked: FieldValue.increment(input.stake),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(stakeTxRef, {
      userId: user.uid,
      userDisplayName: user.displayName,
      type: "BET_STAKE",
      amount: -input.stake,
      balanceAfter: newBalance,
      betId,
      matchId: input.matchId,
      description: `Stake on ${matchLabel}`,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(
      leaderboardRef,
      {
        userId: user.uid,
        displayName: user.displayName,
        balance: newBalance,
        totalBets: FieldValue.increment(1),
        pendingBets: FieldValue.increment(1),
        totalStaked: FieldValue.increment(input.stake),
        netProfit: newBalance - userDoc.startingBalance,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    tx.set(auditRef, {
      actorId: user.uid,
      actorEmail: user.email,
      action: "BET_PLACED",
      entityType: "BET",
      entityId: betId,
      after: { matchId: input.matchId, pick: input.pick, stake: input.stake, odds },
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  return { betId }
}

export async function enterResult(matchId: string, admin: AuthedUser, scores: { homeScore: number; awayScore: number }) {
  const db = getAdminDb()
  const matchRef = db.collection("matches").doc(matchId)
  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")
    const before = matchSnap.data()
    const resultPick = calculateResultPick(scores.homeScore, scores.awayScore)

    tx.update(matchRef, {
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
      resultPick,
      status: "COMPLETED",
      completedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection("auditLogs").doc(), {
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "MATCH_RESULT_ENTERED",
      entityType: "MATCH",
      entityId: matchId,
      before,
      after: { ...scores, resultPick },
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}

export async function settleMatch(matchId: string, admin: AuthedUser) {
  const db = getAdminDb()
  const matchRef = db.collection("matches").doc(matchId)

  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const match = matchSnap.data() as MatchDoc
    if (match.status === "SETTLED") return
    if (match.homeScore === undefined || match.awayScore === undefined) {
      throw new HttpError(400, "Match scores are required before settlement")
    }

    const resultPick = calculateResultPick(match.homeScore, match.awayScore)
    const pendingQuery = db
      .collection("bets")
      .where("matchId", "==", matchId)
      .where("status", "==", "PENDING")
    const pendingBets = await tx.get(pendingQuery)
    const userSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>()

    for (const betSnap of pendingBets.docs) {
      const bet = betSnap.data() as BetDoc
      if (!userSnaps.has(bet.userId)) {
        userSnaps.set(bet.userId, await tx.get(db.collection("users").doc(bet.userId)))
      }
    }

    for (const betSnap of pendingBets.docs) {
      const bet = betSnap.data() as BetDoc
      const userSnap = userSnaps.get(bet.userId)
      if (!userSnap?.exists) continue

      const bettor = userSnap.data() as UserDoc
      const won = bet.pick === resultPick
      const payout = won ? calculatePayout(bet.stake, bet.odds) : 0
      const newBalance = bettor.balance + payout
      const userRef = db.collection("users").doc(bet.userId)
      const leaderboardRef = db.collection("leaderboard").doc(bet.userId)

      tx.update(betSnap.ref, {
        status: won ? "WON" : "LOST",
        payout,
        settledAt: FieldValue.serverTimestamp(),
      })

      if (won) {
        tx.update(userRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() })
        tx.set(db.collection("walletTransactions").doc(`payout_${betSnap.id}`), {
          userId: bet.userId,
          userDisplayName: bet.userDisplayName,
          type: "BET_PAYOUT",
          amount: payout,
          balanceAfter: newBalance,
          betId: betSnap.id,
          matchId,
          description: `Payout for ${bet.matchLabel}`,
          createdAt: FieldValue.serverTimestamp(),
        })
      }

      tx.set(
        leaderboardRef,
        {
          userId: bet.userId,
          displayName: bet.userDisplayName,
          balance: newBalance,
          pendingBets: FieldValue.increment(-1),
          wonBets: FieldValue.increment(won ? 1 : 0),
          lostBets: FieldValue.increment(won ? 0 : 1),
          totalPayout: FieldValue.increment(payout),
          netProfit: newBalance - bettor.startingBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }

    tx.update(matchRef, {
      status: "SETTLED",
      resultPick,
      settledAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection("auditLogs").doc(), {
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "MATCH_SETTLED",
      entityType: "MATCH",
      entityId: matchId,
      after: { resultPick, settledBets: pendingBets.size },
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}

export async function voidMatch(matchId: string, admin: AuthedUser) {
  const db = getAdminDb()
  const matchRef = db.collection("matches").doc(matchId)

  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")
    const match = matchSnap.data() as MatchDoc
    if (match.status === "VOIDED") return

    const pendingQuery = db
      .collection("bets")
      .where("matchId", "==", matchId)
      .where("status", "==", "PENDING")
    const pendingBets = await tx.get(pendingQuery)
    const userSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>()

    for (const betSnap of pendingBets.docs) {
      const bet = betSnap.data() as BetDoc
      if (!userSnaps.has(bet.userId)) {
        userSnaps.set(bet.userId, await tx.get(db.collection("users").doc(bet.userId)))
      }
    }

    for (const betSnap of pendingBets.docs) {
      const bet = betSnap.data() as BetDoc
      const userSnap = userSnaps.get(bet.userId)
      if (!userSnap?.exists) continue
      const bettor = userSnap.data() as UserDoc
      const newBalance = bettor.balance + bet.stake

      tx.update(betSnap.ref, {
        status: "VOIDED",
        payout: bet.stake,
        settledAt: FieldValue.serverTimestamp(),
      })
      tx.update(db.collection("users").doc(bet.userId), {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.collection("walletTransactions").doc(`void_${betSnap.id}`), {
        userId: bet.userId,
        userDisplayName: bet.userDisplayName,
        type: "VOID_REFUND",
        amount: bet.stake,
        balanceAfter: newBalance,
        betId: betSnap.id,
        matchId,
        description: `Void refund for ${bet.matchLabel}`,
        createdAt: FieldValue.serverTimestamp(),
      })
      tx.set(
        db.collection("leaderboard").doc(bet.userId),
        {
          balance: newBalance,
          pendingBets: FieldValue.increment(-1),
          netProfit: newBalance - bettor.startingBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }

    tx.update(matchRef, {
      status: "VOIDED",
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection("auditLogs").doc(), {
      actorId: admin.uid,
      actorEmail: admin.email,
      action: "MATCH_VOIDED",
      entityType: "MATCH",
      entityId: matchId,
      after: { refundedBets: pendingBets.size },
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}
