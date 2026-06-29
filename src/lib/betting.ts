import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { getAdminDb } from "@/lib/firebase/admin"
import { DEFAULT_LOCALE, formatMessage, messages, unitLabel, type Locale } from "@/lib/i18n"
import { isKnockoutStage } from "@/lib/match-rules"
import { toDate } from "@/lib/time"
import type { AuthedUser } from "@/lib/auth"
import { HttpError } from "@/lib/auth"
import type { BetDoc, BetPick, MatchDoc, UserDoc } from "@/types/betting"

export const AUTOMATIC_MISSING_BET_LOSS_START_DATE = "2026-06-25"
const AUTOMATIC_MISSING_BET_LOSS_START_MS = Date.UTC(2026, 5, 25)

export type SettlementResult = {
  settled: boolean
  updated: boolean
  automaticLostBets: number
}

export type MissingBetLossResult = {
  applied: number
  skipped: number
  failed: number
}

export type InvalidSettledBetRepairResult = {
  repaired: number
  failed: number
}

export type PlaceBetInput = {
  matchId: string
  pick: Exclude<BetPick, "NO_BET">
  stake: number
  locale?: Locale
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

export function shouldAutoLoseMissingBets(kickoffAt: MatchDoc["kickoffAt"] | Date | string | number) {
  return toDate(kickoffAt).getTime() >= AUTOMATIC_MISSING_BET_LOSS_START_MS
}

export function shouldChargeAutomaticMissingBetLoss(user: Pick<UserDoc, "isActive" | "role">) {
  return user.isActive
}

export function hasCompletedFinalScore(match: Pick<MatchDoc, "status" | "homeScore" | "awayScore">) {
  return (
    ["COMPLETED", "SETTLED"].includes(match.status) &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined
  )
}

export function shouldCreateMissingNoBetLossesOnSettlement(
  match: Pick<MatchDoc, "status" | "homeScore" | "awayScore"> & {
    kickoffAt: MatchDoc["kickoffAt"] | Date | string | number
  },
) {
  return shouldAutoLoseMissingBets(match.kickoffAt) && hasCompletedFinalScore(match)
}

export function canMatchAcceptNewBet(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  teamsConfirmed?: boolean
  locale?: Locale
}) {
  const t = messages[params.locale ?? DEFAULT_LOCALE]
  if (params.teamsConfirmed === false) return { ok: false, reason: t.errors.teamsUnconfirmed }
  if (params.nowMs >= params.kickoffMs) return { ok: false, reason: t.errors.bettingLocked }
  if (!["SCHEDULED", "OPEN"].includes(params.matchStatus)) {
    return { ok: false, reason: t.errors.matchNotOpen }
  }
  return { ok: true, reason: undefined }
}

export function isMatchBettableForUser(params: {
  nowMs: number
  kickoffMs: number
  matchStatus: string
  teamsConfirmed?: boolean
  hasUserBet?: boolean
  locale?: Locale
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
  pick?: Exclude<BetPick, "NO_BET">
  matchStage?: MatchDoc["stage"]
  existingBet?: Pick<BetDoc, "stake" | "status"> | null
  locale?: Locale
}) {
  const locale = params.locale ?? DEFAULT_LOCALE
  const t = messages[locale]
  const matchAllowed = canMatchAcceptNewBet(params)
  if (!matchAllowed.ok) return matchAllowed
  if (params.stake !== DEFAULT_BET_STAKE) {
    return { ok: false, reason: formatMessage(t.errors.stakeExact, { amount: unitLabel(DEFAULT_BET_STAKE, locale) }) }
  }
  if (params.existingBet && params.existingBet.status !== "PENDING") {
    return { ok: false, reason: t.errors.editPendingOnly }
  }
  if (params.pick === "DRAW" && isKnockoutStage(params.matchStage)) {
    return { ok: false, reason: t.errors.drawNotAvailable }
  }
  const existingStake = params.existingBet?.stake ?? 0
  const additionalStake = Math.max(0, params.stake - existingStake)
  if (params.userBalance < additionalStake) return { ok: false, reason: t.errors.insufficientBalance }
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
  const locale = input.locale ?? DEFAULT_LOCALE
  const t = messages[locale]

  const action = await db.runTransaction<"placed" | "updated">(async (tx) => {
    const [userSnap, matchSnap, existingBet] = await Promise.all([
      tx.get(userRef),
      tx.get(matchRef),
      tx.get(betRef),
    ])

    if (!userSnap.exists) throw new HttpError(404, t.errors.userNotFound)
    if (!matchSnap.exists) throw new HttpError(404, t.errors.matchNotFound)

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
      pick: input.pick,
      matchStage: match.stage,
      locale,
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
      ...(userDoc.groupId ? { groupId: userDoc.groupId } : {}),
      ...(userDoc.groupName ? { groupName: userDoc.groupName } : {}),
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
        ...(userDoc.groupId ? {} : { groupId: FieldValue.delete() }),
        ...(userDoc.groupName ? {} : { groupName: FieldValue.delete() }),
        predictedHomeScore: FieldValue.delete(),
        predictedAwayScore: FieldValue.delete(),
        updatedAt: savedAt,
      })
    } else {
      const betDoc: BetDoc = {
        ...betFields,
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
            },
          }
        : {}),
      after: {
        matchId: input.matchId,
        pick: input.pick,
        stake: input.stake,
        stakeDelta,
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

  return db.runTransaction<SettlementResult>(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const match = matchSnap.data() as MatchDoc
    const alreadySettled = match.status === "SETTLED"
    if (alreadySettled && !shouldAutoLoseMissingBets(match.kickoffAt)) {
      return { settled: false, updated: false, automaticLostBets: 0 }
    }
    if (!hasCompletedFinalScore(match)) {
      throw new HttpError(400, "Match must be completed with a final score before settlement")
    }

    const resultPick =
      match.resultPick ??
      calculateFinalResultPick({
        homeScore: match.homeScore!,
        awayScore: match.awayScore!,
      })
    const matchBetsQuery = db.collection("bets").where("matchId", "==", matchId)
    const matchBets = await tx.get(matchBetsQuery)
    const pendingBets = matchBets.docs.filter((doc) => (doc.data() as BetDoc).status === "PENDING")
    const existingBetUserIds = new Set(matchBets.docs.map((doc) => String((doc.data() as Partial<BetDoc>).userId)))
    const userSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>()
    const automaticLossUserSnaps: FirebaseFirestore.QueryDocumentSnapshot[] = []

    if (shouldCreateMissingNoBetLossesOnSettlement(match)) {
      const users = await tx.get(db.collection("users"))
      for (const userSnap of users.docs) {
        const user = userSnap.data() as UserDoc
        if (!shouldChargeAutomaticMissingBetLoss(user)) continue
        automaticLossUserSnaps.push(userSnap)
        userSnaps.set(userSnap.id, userSnap)
      }
    }

    for (const betSnap of pendingBets) {
      const bet = betSnap.data() as BetDoc
      if (!userSnaps.has(bet.userId)) {
        userSnaps.set(bet.userId, await tx.get(db.collection("users").doc(bet.userId)))
      }
    }

    for (const betSnap of pendingBets) {
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

    let automaticLostBets = 0
    for (const userSnap of automaticLossUserSnaps) {
      if (existingBetUserIds.has(userSnap.id)) continue

      const bettor = userSnap.data() as UserDoc
      const betId = `${matchId}_${userSnap.id}`
      const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`
      const newBalance = bettor.balance - DEFAULT_BET_STAKE
      const autoLossFields = {
        userId: userSnap.id,
        userEmail: bettor.email,
        userDisplayName: bettor.displayName,
        ...(bettor.groupId ? { groupId: bettor.groupId } : {}),
        ...(bettor.groupName ? { groupName: bettor.groupName } : {}),
        matchId,
        matchLabel,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        ...(match.homeTeamCode ? { homeTeamCode: match.homeTeamCode } : {}),
        ...(match.awayTeamCode ? { awayTeamCode: match.awayTeamCode } : {}),
        kickoffAt: match.kickoffAt,
        pick: "NO_BET" as const,
        stake: DEFAULT_BET_STAKE,
        potentialPayout: 0,
        fundContribution: DEFAULT_BET_STAKE,
        status: "LOST" as const,
        payout: 0,
        placedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        settledAt: FieldValue.serverTimestamp(),
      }

      tx.set(db.collection("bets").doc(betId), autoLossFields)
      tx.update(db.collection("users").doc(userSnap.id), {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.collection("walletTransactions").doc(`auto_loss_${betId}`), {
        userId: userSnap.id,
        userDisplayName: bettor.displayName,
        type: "BET_STAKE",
        amount: -DEFAULT_BET_STAKE,
        balanceAfter: newBalance,
        betId,
        matchId,
        description: `Automatic loss for not betting on ${matchLabel}`,
        createdAt: FieldValue.serverTimestamp(),
      })
      tx.set(
        db.collection("leaderboard").doc(userSnap.id),
        {
        userId: userSnap.id,
        displayName: bettor.displayName,
        balance: newBalance,
        totalBets: FieldValue.increment(1),
        lostBets: FieldValue.increment(1),
          totalStaked: FieldValue.increment(DEFAULT_BET_STAKE),
          netProfit: newBalance - bettor.startingBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      automaticLostBets += 1
    }

    if (!alreadySettled || automaticLostBets > 0) {
      tx.update(matchRef, {
        ...(!alreadySettled
          ? {
              status: "SETTLED",
              resultPick,
              settledAt: FieldValue.serverTimestamp(),
            }
          : {}),
        ...(automaticLostBets
          ? {
              betCount: FieldValue.increment(automaticLostBets),
              totalStaked: FieldValue.increment(automaticLostBets * DEFAULT_BET_STAKE),
            }
          : {}),
        updatedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: alreadySettled ? "MATCH_AUTOMATIC_LOSSES_APPLIED" : "MATCH_SETTLED",
        entityType: "MATCH",
        entityId: matchId,
        after: { resultPick, settledBets: pendingBets.length, automaticLostBets },
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return {
      settled: !alreadySettled,
      updated: alreadySettled && automaticLostBets > 0,
      automaticLostBets,
    }
  })
}

export async function applyAutomaticMissingBetLosses(
  matchId: string,
  admin: AuthedUser,
  db: Firestore = getAdminDb(),
) {
  const matchRef = db.collection("matches").doc(matchId)

  return db.runTransaction<SettlementResult>(async (tx) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpError(404, "Match not found")

    const match = matchSnap.data() as MatchDoc
    if (!shouldAutoLoseMissingBets(match.kickoffAt)) {
      return { settled: false, updated: false, automaticLostBets: 0 }
    }

    const matchBets = await tx.get(db.collection("bets").where("matchId", "==", matchId))
    const existingBetUserIds = new Set(matchBets.docs.map((doc) => String((doc.data() as Partial<BetDoc>).userId)))
    const users = await tx.get(db.collection("users"))
    const automaticLossUserSnaps = users.docs.filter((userSnap) => {
      const user = userSnap.data() as UserDoc
      return shouldChargeAutomaticMissingBetLoss(user) && !existingBetUserIds.has(userSnap.id)
    })

    for (const userSnap of automaticLossUserSnaps) {
      const bettor = userSnap.data() as UserDoc
      const betId = `${matchId}_${userSnap.id}`
      const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`
      const newBalance = bettor.balance - DEFAULT_BET_STAKE

      tx.set(db.collection("bets").doc(betId), {
        userId: userSnap.id,
        userEmail: bettor.email,
        userDisplayName: bettor.displayName,
        ...(bettor.groupId ? { groupId: bettor.groupId } : {}),
        ...(bettor.groupName ? { groupName: bettor.groupName } : {}),
        matchId,
        matchLabel,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        ...(match.homeTeamCode ? { homeTeamCode: match.homeTeamCode } : {}),
        ...(match.awayTeamCode ? { awayTeamCode: match.awayTeamCode } : {}),
        kickoffAt: match.kickoffAt,
        pick: "NO_BET",
        stake: DEFAULT_BET_STAKE,
        potentialPayout: 0,
        fundContribution: 0,
        status: "PENDING",
        payout: 0,
        placedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.update(db.collection("users").doc(userSnap.id), {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.collection("walletTransactions").doc(`auto_loss_${betId}`), {
        userId: userSnap.id,
        userDisplayName: bettor.displayName,
        type: "BET_STAKE",
        amount: -DEFAULT_BET_STAKE,
        balanceAfter: newBalance,
        betId,
        matchId,
        description: `Automatic loss for not betting on ${matchLabel}`,
        createdAt: FieldValue.serverTimestamp(),
      })
      tx.set(
        db.collection("leaderboard").doc(userSnap.id),
        {
          userId: userSnap.id,
          displayName: bettor.displayName,
          balance: newBalance,
          totalBets: FieldValue.increment(1),
          pendingBets: FieldValue.increment(1),
          totalStaked: FieldValue.increment(DEFAULT_BET_STAKE),
          netProfit: newBalance - bettor.startingBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }

    const automaticLostBets = automaticLossUserSnaps.length
    if (automaticLostBets > 0) {
      tx.update(matchRef, {
        betCount: FieldValue.increment(automaticLostBets),
        totalStaked: FieldValue.increment(automaticLostBets * DEFAULT_BET_STAKE),
        updatedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.collection("auditLogs").doc(), {
        actorId: admin.uid,
        actorEmail: admin.email,
        action: "MATCH_AUTOMATIC_LOSSES_APPLIED",
        entityType: "MATCH",
        entityId: matchId,
        after: { automaticLostBets },
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return {
      settled: false,
      updated: automaticLostBets > 0,
      automaticLostBets,
    }
  })
}

export async function applyAutomaticMissingBetLossesForExpiredMatches(db: Firestore = getAdminDb()) {
  const systemActor: AuthedUser = {
    uid: "schedule-sync",
    email: "system",
    displayName: "Schedule Sync",
    role: "ADMIN",
    isActive: true,
  }
  const result: MissingBetLossResult = { applied: 0, skipped: 0, failed: 0 }
  const snap = await db.collection("matches").where("status", "in", ["LOCKED", "LIVE", "COMPLETED", "SETTLED"]).get()

  for (const doc of snap.docs) {
    const match = doc.data() as MatchDoc
    if (!shouldAutoLoseMissingBets(match.kickoffAt)) {
      result.skipped += 1
      continue
    }

    try {
      const automaticLosses = await applyAutomaticMissingBetLosses(doc.id, systemActor, db)
      if (automaticLosses.automaticLostBets > 0) result.applied += automaticLosses.automaticLostBets
      else result.skipped += 1
    } catch {
      result.failed += 1
    }
  }

  return result
}

export async function resetInvalidSettledBets(db: Firestore = getAdminDb()) {
  const result: InvalidSettledBetRepairResult = { repaired: 0, failed: 0 }
  const snap = await db.collection("bets").where("status", "in", ["WON", "LOST"]).get()

  for (const doc of snap.docs) {
    try {
      const repaired = await db.runTransaction(async (tx) => {
        const betSnap = await tx.get(doc.ref)
        if (!betSnap.exists) return false

        const bet = betSnap.data() as BetDoc
        const matchSnap = await tx.get(db.collection("matches").doc(bet.matchId))
        if (matchSnap.exists && hasCompletedFinalScore(matchSnap.data() as MatchDoc)) return false

        const payout = Number(bet.payout ?? 0)
        const userRef = db.collection("users").doc(bet.userId)
        const userSnap = await tx.get(userRef)
        const bettor = userSnap.exists ? (userSnap.data() as UserDoc) : null
        const newBalance = bettor ? bettor.balance - payout : undefined

        tx.update(betSnap.ref, {
          status: "PENDING",
          payout: 0,
          fundContribution: 0,
          settledAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        if (bettor && payout > 0) {
          tx.update(userRef, {
            balance: newBalance,
            updatedAt: FieldValue.serverTimestamp(),
          })
          tx.set(db.collection("walletTransactions").doc(`payout_reversal_${betSnap.id}`), {
            userId: bet.userId,
            userDisplayName: bet.userDisplayName,
            type: "ADMIN_ADJUSTMENT",
            amount: -payout,
            balanceAfter: newBalance,
            betId: betSnap.id,
            matchId: bet.matchId,
            description: `Reversal of premature payout for ${bet.matchLabel}`,
            createdAt: FieldValue.serverTimestamp(),
          })
        }

        tx.set(
          db.collection("leaderboard").doc(bet.userId),
          {
            userId: bet.userId,
            displayName: bet.userDisplayName,
            ...(newBalance !== undefined ? { balance: newBalance, netProfit: newBalance - bettor!.startingBalance } : {}),
            pendingBets: FieldValue.increment(1),
            wonBets: FieldValue.increment(bet.status === "WON" ? -1 : 0),
            lostBets: FieldValue.increment(bet.status === "LOST" ? -1 : 0),
            totalPayout: FieldValue.increment(-payout),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        tx.set(db.collection("auditLogs").doc(), {
          actorId: "schedule-sync",
          actorEmail: "system",
          action: "INVALID_SETTLED_BET_RESET",
          entityType: "BET",
          entityId: betSnap.id,
          before: { status: bet.status, payout: bet.payout, fundContribution: bet.fundContribution },
          after: { status: "PENDING", payout: 0, fundContribution: 0 },
          createdAt: FieldValue.serverTimestamp(),
        })

        return true
      })

      if (repaired) result.repaired += 1
    } catch {
      result.failed += 1
    }
  }

  return result
}

export async function settleCompletedMatches(db: Firestore = getAdminDb()) {
  const systemActor: AuthedUser = {
    uid: "schedule-sync",
    email: "system",
    displayName: "Schedule Sync",
    role: "ADMIN",
    isActive: true,
  }
  const result = { settled: 0, updated: 0, skipped: 0, failed: 0 }
  const [completedSnap, settledSnap] = await Promise.all([
    db.collection("matches").where("status", "==", "COMPLETED").get(),
    db.collection("matches").where("status", "==", "SETTLED").get(),
  ])
  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()

  for (const doc of completedSnap.docs) docsById.set(doc.id, doc)
  for (const doc of settledSnap.docs) {
    const match = doc.data() as MatchDoc
    if (shouldAutoLoseMissingBets(match.kickoffAt)) docsById.set(doc.id, doc)
  }

  for (const doc of docsById.values()) {
    const match = doc.data() as MatchDoc
    if (!hasCompletedFinalScore(match)) {
      result.skipped += 1
      continue
    }

    try {
      const settlement = await settleMatch(doc.id, systemActor, db)
      if (settlement.settled) result.settled += 1
      else if (settlement.updated) result.updated += 1
      else result.skipped += 1
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
