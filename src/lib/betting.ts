import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
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

export function calculateFinalResultPick(params: {
  homeScore: number
  awayScore: number
  winner?: Extract<BetPick, "HOME" | "AWAY">
}): BetPick {
  return params.winner ?? calculateResultPick(params.homeScore, params.awayScore)
}

export function calculatePayout(stake: number) {
  return stake
}

export function calculateFundContribution(stake: number, won: boolean) {
  return won ? 0 : stake
}

export function canMatchAcceptNewBet(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  teamsConfirmed?: boolean
}) {
  if (params.teamsConfirmed === false) return { ok: false, reason: "Teams are not confirmed for this match" }
  if (params.nowMs >= params.kickoffMs) return { ok: false, reason: "Betting is locked for this match" }
  if (!["SCHEDULED", "OPEN"].includes(params.matchStatus)) {
    return { ok: false, reason: "This match is not open for betting" }
  }
  return { ok: true, reason: undefined }
}

export function isMatchBettableForUser(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  teamsConfirmed?: boolean
  hasUserBet?: boolean
}) {
  return canMatchAcceptNewBet(params).ok
}

export function canPlaceBet(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  teamsConfirmed?: boolean
  userBalance: number
  stake: number
  existingBet?: Pick<BetDoc, "stake" | "status"> | null
}) {
  const matchAllowed = canMatchAcceptNewBet(params)
  if (!matchAllowed.ok) return matchAllowed
  if (params.stake !== DEFAULT_BET_STAKE) {
    return { ok: false, reason: `Stake must be exactly ${DEFAULT_BET_STAKE}` }
  }
  if (params.existingBet && params.existingBet.status !== "PENDING") {
    return { ok: false, reason: "Only pending bets can be edited" }
  }
  const existingStake = params.existingBet?.stake ?? 0
  const additionalStake = Math.max(0, params.stake - existingStake)
  if (params.userBalance < additionalStake) return { ok: false, reason: "Insufficient balance" }
  return { ok: true, reason: undefined }
}

export async function placeBet(user: AuthedUser, input: PlaceBetInput) {
  const db = getAdminDb()
  const userRef = db.collection("users").doc(user.uid)
  const matchRef = db.collection("matches").doc(input.matchId)
  const betId = `${input.matchId}_${user.uid}`
  const betRef = db.collection("bets").doc(betId)
  const stakeTxRef = db.collection("walletTransactions").doc(`stake_${betId}`)
  const stakeAdjustmentTxRef = db.collection("walletTransactions").doc()
  const leaderboardRef = db.collection("leaderboard").doc(user.uid)
  const auditRef = db.collection("auditLogs").doc()

  const action = await db.runTransaction<"placed" | "updated">(async (tx) => {
    const [userSnap, matchSnap, existingBet] = await Promise.all([
      tx.get(userRef),
      tx.get(matchRef),
      tx.get(betRef),
    ])

    if (!userSnap.exists) throw new HttpError(404, "User profile not found")
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const userDoc = userSnap.data() as UserDoc
    const match = matchSnap.data() as MatchDoc
    const existingBetDoc = existingBet.exists ? (existingBet.data() as BetDoc) : null
    const kickoffMs = match.kickoffAt.toMillis?.() ?? 0
    const nowMs = Date.now()
    const allowed = canPlaceBet({
      nowMs,
      kickoffMs,
      matchStatus: match.status,
      teamsConfirmed: match.teamsConfirmed,
      userBalance: userDoc.balance,
      stake: input.stake,
      existingBet: existingBetDoc ? { stake: existingBetDoc.stake, status: existingBetDoc.status } : null,
    })

    if (!allowed.ok) throw new HttpError(400, allowed.reason ?? "Bet is not allowed")
    if (!userDoc.isActive) throw new HttpError(403, "User is inactive")

    const potentialPayout = calculatePayout(input.stake)
    const previousStake = existingBetDoc?.stake ?? 0
    const stakeDelta = input.stake - previousStake
    const newBalance = userDoc.balance - stakeDelta
    const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`
    const savedAt = Timestamp.fromMillis(nowMs)
    const action = existingBetDoc ? "updated" : "placed"

    const betFields = {
      userId: user.uid,
      userEmail: user.email,
      userDisplayName: user.displayName,
      matchId: input.matchId,
      matchLabel,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      ...(match.homeTeamCode ? { homeTeamCode: match.homeTeamCode } : {}),
      ...(match.awayTeamCode ? { awayTeamCode: match.awayTeamCode } : {}),
      kickoffAt: match.kickoffAt,
      pick: input.pick,
      stake: input.stake,
      potentialPayout,
      fundContribution: 0,
      status: "PENDING" as const,
      payout: 0,
    }

    if (existingBetDoc) {
      tx.update(betRef, {
        ...betFields,
        predictedHomeScore:
          input.predictedHomeScore === undefined ? FieldValue.delete() : input.predictedHomeScore,
        predictedAwayScore:
          input.predictedAwayScore === undefined ? FieldValue.delete() : input.predictedAwayScore,
        updatedAt: savedAt,
      })
    } else {
      const betDoc: BetDoc = {
        ...betFields,
        ...(input.predictedHomeScore === undefined
          ? {}
          : { predictedHomeScore: input.predictedHomeScore }),
        ...(input.predictedAwayScore === undefined
          ? {}
          : { predictedAwayScore: input.predictedAwayScore }),
        placedAt: savedAt,
        updatedAt: savedAt,
      }
      tx.set(betRef, betDoc)
    }
    tx.update(userRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() })
    tx.update(matchRef, {
      ...(existingBetDoc ? {} : { betCount: FieldValue.increment(1) }),
      totalStaked: FieldValue.increment(stakeDelta),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (existingBetDoc) {
      if (stakeDelta !== 0) {
        tx.set(stakeAdjustmentTxRef, {
          userId: user.uid,
          userDisplayName: user.displayName,
          type: "BET_STAKE_ADJUSTMENT",
          amount: -stakeDelta,
          balanceAfter: newBalance,
          betId,
          matchId: input.matchId,
          description: `${stakeDelta > 0 ? "Increased" : "Reduced"} stake on ${matchLabel}`,
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    } else {
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
    }
    tx.set(
      leaderboardRef,
      {
        userId: user.uid,
        displayName: user.displayName,
        balance: newBalance,
        ...(existingBetDoc
          ? {}
          : {
              totalBets: FieldValue.increment(1),
              pendingBets: FieldValue.increment(1),
            }),
        totalStaked: FieldValue.increment(stakeDelta),
        netProfit: newBalance - userDoc.startingBalance,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    tx.set(auditRef, {
      actorId: user.uid,
      actorEmail: user.email,
      action: existingBetDoc ? "BET_UPDATED" : "BET_PLACED",
      entityType: "BET",
      entityId: betId,
      ...(existingBetDoc
        ? {
            before: {
              pick: existingBetDoc.pick,
              stake: existingBetDoc.stake,
              ...(existingBetDoc.predictedHomeScore === undefined
                ? {}
                : { predictedHomeScore: existingBetDoc.predictedHomeScore }),
              ...(existingBetDoc.predictedAwayScore === undefined
                ? {}
                : { predictedAwayScore: existingBetDoc.predictedAwayScore }),
            },
          }
        : {}),
      after: {
        matchId: input.matchId,
        pick: input.pick,
        stake: input.stake,
        stakeDelta,
        ...(input.predictedHomeScore === undefined ? {} : { predictedHomeScore: input.predictedHomeScore }),
        ...(input.predictedAwayScore === undefined ? {} : { predictedAwayScore: input.predictedAwayScore }),
      },
      createdAt: FieldValue.serverTimestamp(),
    })
    return action
  })

  return { betId, action }
}

export async function enterResult(
  matchId: string,
  admin: AuthedUser,
  scores: { homeScore: number; awayScore: number; resultPick?: BetPick },
) {
  const db = getAdminDb()
  const matchRef = db.collection("matches").doc(matchId)
  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")
    const before = matchSnap.data()
    const resultPick = scores.resultPick ?? calculateFinalResultPick(scores)

    tx.update(matchRef, {
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
      resultPick,
      resultSourceDetail: "manual",
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

export async function settleMatch(matchId: string, admin: AuthedUser, db: Firestore = getAdminDb()) {
  const matchRef = db.collection("matches").doc(matchId)

  await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const match = matchSnap.data() as MatchDoc
    if (match.status === "SETTLED") return
    if (!match.resultPick && (match.homeScore === undefined || match.awayScore === undefined)) {
      throw new HttpError(400, "Match result is required before settlement")
    }

    const resultPick =
      match.resultPick ??
      calculateFinalResultPick({
        homeScore: match.homeScore!,
        awayScore: match.awayScore!,
      })
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
      const payout = won ? calculatePayout(bet.stake) : 0
      const fundContribution = calculateFundContribution(bet.stake, won)
      const newBalance = bettor.balance + payout
      const userRef = db.collection("users").doc(bet.userId)
      const leaderboardRef = db.collection("leaderboard").doc(bet.userId)

      tx.update(betSnap.ref, {
        status: won ? "WON" : "LOST",
        payout,
        fundContribution,
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

export async function settleCompletedMatches(db: Firestore = getAdminDb()) {
  const systemActor: AuthedUser = {
    uid: "schedule-sync",
    email: "system",
    displayName: "Schedule Sync",
    role: "ADMIN",
    isActive: true,
  }
  const result = { settled: 0, skipped: 0, failed: 0 }
  const snap = await db.collection("matches").where("status", "==", "COMPLETED").get()

  for (const doc of snap.docs) {
    const match = doc.data() as MatchDoc
    const hasResult = Boolean(
      match.resultPick || (match.homeScore !== undefined && match.awayScore !== undefined),
    )

    if (!hasResult) {
      result.skipped += 1
      continue
    }

    try {
      await settleMatch(doc.id, systemActor, db)
      result.settled += 1
    } catch {
      result.failed += 1
    }
  }

  return result
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
        fundContribution: 0,
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
