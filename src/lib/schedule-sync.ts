import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import type { BetPick, MatchDoc, MatchStage, MatchStatus } from "@/types/betting"

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200"
const THE_STATS_API_FIXTURES_URL = "https://www.thestatsapi.com/world-cup/data/fixtures.json"
const TERMINAL_MATCH_STATUSES = new Set<MatchStatus>(["SETTLED", "VOIDED"])
const RESULT_SOURCE_STATUSES = new Set<MatchStatus>(["LIVE", "COMPLETED"])

export type ScheduleSource = "espn" | "thestatsapi"

export type NormalizedWorldCupFixture = {
  id: string
  externalId: string
  source: ScheduleSource
  sourceUpdatedAt: Date
  matchNumber: number
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  groupName?: string
  stage: MatchStage
  kickoffAt: Date
  status: MatchStatus
  homeScore?: number
  awayScore?: number
  homeShootoutScore?: number
  awayShootoutScore?: number
  resultPick?: BetPick
  resultSourceDetail?: string
  venueName?: string
  hostCity?: string
  teamsConfirmed: boolean
}

export type ScheduleSyncResult = {
  source: ScheduleSource
  created: number
  updated: number
  skipped: number
  failed: number
}

type MatchSyncDecision =
  | { operation: "create"; data: Record<string, unknown> }
  | { operation: "update"; data: Record<string, unknown> }
  | { operation: "skip"; reason: string }

type EspnEvent = {
  id?: string
  date?: string
  season?: { slug?: string }
  competitions?: EspnCompetition[]
  status?: EspnStatus
  venue?: { displayName?: string }
}

type EspnCompetition = {
  date?: string
  startDate?: string
  competitors?: EspnCompetitor[]
  status?: EspnStatus
  venue?: { fullName?: string; address?: { city?: string } }
  altGameNote?: string
}

type EspnCompetitor = {
  homeAway?: "home" | "away"
  score?: string
  winner?: boolean
  shootoutScore?: number | string
  team?: {
    abbreviation?: string
    displayName?: string
    shortDisplayName?: string
    name?: string
  }
}

type EspnStatus = {
  type?: {
    state?: string
    name?: string
    completed?: boolean
    detail?: string
    shortDetail?: string
  }
}

type TheStatsApiFixture = {
  matchNumber?: number
  kickoffUtc?: string
  stage?: string
  group?: string | null
  homeTeam?: string
  awayTeam?: string
  stadium?: string
  hostCity?: string
}

export async function fetchEspnWorldCupSchedule(now = new Date()): Promise<NormalizedWorldCupFixture[]> {
  const response = await fetch(ESPN_SCOREBOARD_URL, { cache: "no-store" })
  if (!response.ok) throw new Error(`ESPN schedule fetch failed with ${response.status}`)

  const json = (await response.json()) as { events?: EspnEvent[] }
  const events = [...(json.events ?? [])].sort((a, b) => {
    return new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
  })

  if (!events.length) throw new Error("ESPN schedule response did not include events")
  return events.map((event, index) => normalizeWorldCupFixture("espn", event, index + 1, now))
}

export async function fetchTheStatsApiFixturesFallback(now = new Date()): Promise<NormalizedWorldCupFixture[]> {
  const response = await fetch(THE_STATS_API_FIXTURES_URL, { cache: "no-store" })
  if (!response.ok) throw new Error(`TheStatsAPI schedule fetch failed with ${response.status}`)

  const json = (await response.json()) as { fixtures?: TheStatsApiFixture[] }
  const fixtures = json.fixtures ?? []
  if (!fixtures.length) throw new Error("TheStatsAPI schedule response did not include fixtures")
  return fixtures.map((fixture, index) => normalizeWorldCupFixture("thestatsapi", fixture, index + 1, now))
}

export function normalizeWorldCupFixture(
  source: ScheduleSource,
  rawFixture: EspnEvent | TheStatsApiFixture,
  fallbackMatchNumber: number,
  now = new Date(),
): NormalizedWorldCupFixture {
  if (source === "espn") {
    return normalizeEspnFixture(rawFixture as EspnEvent, fallbackMatchNumber, now)
  }
  return normalizeTheStatsApiFixture(rawFixture as TheStatsApiFixture, fallbackMatchNumber, now)
}

export function mapWorldCupStage(stage?: string, matchNumber?: number): MatchStage {
  const normalized = stage?.trim().toLowerCase().replace(/_/g, "-") ?? ""
  if (normalized.includes("third")) return "THIRD_PLACE"
  if (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("quarter")) return "FINAL"
  if (normalized.includes("semi")) return "SEMI_FINAL"
  if (normalized.includes("quarter")) return "QUARTER_FINAL"
  if (normalized.includes("round-of-16") || normalized.includes("rd-of-16")) return "ROUND_OF_16"
  if (normalized.includes("round-of-32")) return "ROUND_OF_32"
  if (normalized.includes("group")) return "GROUP"

  if (matchNumber === 103) return "THIRD_PLACE"
  if (matchNumber === 104) return "FINAL"
  if (matchNumber && matchNumber >= 101) return "SEMI_FINAL"
  if (matchNumber && matchNumber >= 97) return "QUARTER_FINAL"
  if (matchNumber && matchNumber >= 89) return "ROUND_OF_16"
  if (matchNumber && matchNumber >= 73) return "ROUND_OF_32"
  return "GROUP"
}

export function buildMatchSyncDecision(
  fixture: NormalizedWorldCupFixture,
  existing: Partial<MatchDoc> | undefined,
  nowMs = Date.now(),
): MatchSyncDecision {
  if (!existing) {
    return {
      operation: "create",
      data: removeUndefined({
        ...fixtureFields(fixture),
        betCount: 0,
        totalStaked: 0,
        createdBy: "schedule-sync",
        updatedBy: "schedule-sync",
      }),
    }
  }

  if (existing.status && TERMINAL_MATCH_STATUSES.has(existing.status)) {
    return { operation: "skip", reason: "terminal-status" }
  }

  const existingKickoffMs = toMillis(existing.kickoffAt)
  const fixtureKickoffMs = fixture.kickoffAt.getTime()
  const beforeKickoff = (existingKickoffMs ?? fixtureKickoffMs) > nowMs
  const ongoing = existing.status === "LIVE" || fixture.status === "LIVE"
  const completedWithScores = fixture.status === "COMPLETED" && hasScores(fixture)

  if (!beforeKickoff && !ongoing && !completedWithScores) {
    return { operation: "skip", reason: "past-match" }
  }

  const data: Record<string, unknown> = {
    externalId: fixture.externalId,
    source: fixture.source,
    sourceUpdatedAt: fixture.sourceUpdatedAt,
    matchNumber: fixture.matchNumber,
    venueName: fixture.venueName,
    hostCity: fixture.hostCity,
    teamsConfirmed: fixture.teamsConfirmed,
    updatedBy: "schedule-sync",
  }

  if (beforeKickoff) {
    Object.assign(data, {
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeTeamCode: fixture.homeTeamCode,
      awayTeamCode: fixture.awayTeamCode,
      groupName: fixture.groupName,
      stage: fixture.stage,
      kickoffAt: fixture.kickoffAt,
      status: fixture.status,
    })
  } else if (fixture.status === "LIVE" || completedWithScores) {
    Object.assign(data, {
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeShootoutScore: fixture.homeShootoutScore,
      awayShootoutScore: fixture.awayShootoutScore,
      resultPick: fixture.resultPick,
      resultSourceDetail: fixture.resultSourceDetail,
    })
  }

  return { operation: "update", data: removeUndefined(data) }
}

export async function syncWorldCupSchedule(db: Firestore = getAdminDb()): Promise<ScheduleSyncResult> {
  const { source, fixtures } = await fetchConfiguredSchedule()
  const result: ScheduleSyncResult = { source, created: 0, updated: 0, skipped: 0, failed: 0 }
  const nowMs = Date.now()

  for (const fixture of fixtures) {
    try {
      const operation = await db.runTransaction(async (tx) => {
        const matchRef = db.collection("matches").doc(fixture.id)
        const before = await tx.get(matchRef)
        const decision = buildMatchSyncDecision(
          fixture,
          before.exists ? (before.data() as MatchDoc) : undefined,
          nowMs,
        )

        if (decision.operation === "skip") {
          return "skipped"
        }

        const firestoreData = toFirestoreData(decision.data)
        if (decision.operation === "create") {
          tx.set(matchRef, {
            ...firestoreData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
          return "created"
        }

        tx.update(matchRef, {
          ...firestoreData,
          updatedAt: FieldValue.serverTimestamp(),
        })
        return "updated"
      })

      if (operation === "created") result.created += 1
      if (operation === "updated") result.updated += 1
      if (operation === "skipped") result.skipped += 1
    } catch {
      result.failed += 1
    }
  }

  await db.collection("auditLogs").add({
    action: "SCHEDULE_SYNC_COMPLETED",
    entityType: "SYSTEM",
    after: result,
    createdAt: FieldValue.serverTimestamp(),
  })

  return result
}

export async function lockExpiredOpenMatches(db: Firestore = getAdminDb()) {
  const snap = await db
    .collection("matches")
    .where("status", "in", ["SCHEDULED", "OPEN"])
    .where("kickoffAt", "<=", new Date())
    .get()

  if (snap.empty) return 0

  const batch = db.batch()
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "LOCKED",
      lockedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  await batch.commit()
  return snap.size
}

async function fetchConfiguredSchedule() {
  const source = normalizeSource(process.env.SCHEDULE_SYNC_SOURCE) ?? "espn"
  const fallback = normalizeSource(process.env.SCHEDULE_SYNC_FALLBACK) ?? "thestatsapi"

  try {
    return { source, fixtures: await fetchBySource(source) }
  } catch (error) {
    if (source === fallback) throw error
    return { source: fallback, fixtures: await fetchBySource(fallback) }
  }
}

async function fetchBySource(source: ScheduleSource) {
  if (source === "thestatsapi") return fetchTheStatsApiFixturesFallback()
  return fetchEspnWorldCupSchedule()
}

function normalizeSource(value?: string): ScheduleSource | undefined {
  if (value === "espn" || value === "thestatsapi") return value
  return undefined
}

function normalizeEspnFixture(event: EspnEvent, matchNumber: number, now: Date): NormalizedWorldCupFixture {
  if (!event.id) throw new Error("ESPN event is missing id")

  const competition = event.competitions?.[0]
  const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home")
  const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away")
  const homeTeam = teamName(home) ?? "TBD"
  const awayTeam = teamName(away) ?? "TBD"
  const status = mapEspnStatus(competition?.status ?? event.status)
  const sourceStatus = competition?.status ?? event.status
  const date = event.date ?? competition?.date ?? competition?.startDate

  if (!date) throw new Error(`ESPN event ${event.id} is missing kickoff date`)
  const scores = scoreFields(status, home?.score, away?.score)

  return {
    id: `wc2026-match-${matchNumber}`,
    externalId: `espn:fifa.world:${event.id}`,
    source: "espn",
    sourceUpdatedAt: now,
    matchNumber,
    homeTeam,
    awayTeam,
    homeTeamCode: home?.team?.abbreviation,
    awayTeamCode: away?.team?.abbreviation,
    groupName: groupNameFromNote(competition?.altGameNote),
    stage: mapWorldCupStage(event.season?.slug, matchNumber),
    kickoffAt: new Date(date),
    status,
    ...scores,
    ...finalOutcomeFields(status, scores, home, away, sourceStatus),
    venueName: competition?.venue?.fullName ?? event.venue?.displayName,
    hostCity: competition?.venue?.address?.city,
    teamsConfirmed: areTeamsConfirmed(homeTeam, awayTeam),
  }
}

function normalizeTheStatsApiFixture(
  fixture: TheStatsApiFixture,
  fallbackMatchNumber: number,
  now: Date,
): NormalizedWorldCupFixture {
  const matchNumber = fixture.matchNumber ?? fallbackMatchNumber
  const homeTeam = fixture.homeTeam ?? "TBD"
  const awayTeam = fixture.awayTeam ?? "TBD"
  const teamsConfirmed = areTeamsConfirmed(homeTeam, awayTeam)
  const kickoffAt = fixture.kickoffUtc ? new Date(fixture.kickoffUtc) : undefined

  if (!kickoffAt) throw new Error(`TheStatsAPI fixture ${matchNumber} is missing kickoffUtc`)

  return {
    id: `wc2026-match-${matchNumber}`,
    externalId: `thestatsapi:wc2026:${matchNumber}`,
    source: "thestatsapi",
    sourceUpdatedAt: now,
    matchNumber,
    homeTeam,
    awayTeam,
    groupName: fixture.group ? `Group ${fixture.group}` : undefined,
    stage: mapWorldCupStage(fixture.stage, matchNumber),
    kickoffAt,
    status: teamsConfirmed ? "OPEN" : "SCHEDULED",
    venueName: fixture.stadium,
    hostCity: fixture.hostCity,
    teamsConfirmed,
  }
}

function mapEspnStatus(status?: EspnStatus): MatchStatus {
  const type = status?.type
  if (type?.completed || type?.state === "post") return "COMPLETED"
  if (type?.state === "in") return "LIVE"
  return "OPEN"
}

function scoreFields(status: MatchStatus, homeScore?: string, awayScore?: string) {
  if (!RESULT_SOURCE_STATUSES.has(status)) return {}
  const home = scoreNumber(homeScore)
  const away = scoreNumber(awayScore)
  if (home === undefined || away === undefined) return {}
  return { homeScore: home, awayScore: away }
}

function scoreNumber(score?: string) {
  if (score === undefined || score === "") return undefined
  const value = Number(score)
  return Number.isFinite(value) ? value : undefined
}

function finalOutcomeFields(
  status: MatchStatus,
  scores: { homeScore?: number; awayScore?: number },
  home?: EspnCompetitor,
  away?: EspnCompetitor,
  sourceStatus?: EspnStatus,
) {
  if (status !== "COMPLETED") return {}
  if (scores.homeScore === undefined || scores.awayScore === undefined) return {}

  const winner = winnerPick(home, away)
  const resultPick = winner ?? calculateScorePick(scores.homeScore, scores.awayScore)

  return removeUndefined({
    homeShootoutScore: shootoutNumber(home?.shootoutScore),
    awayShootoutScore: shootoutNumber(away?.shootoutScore),
    resultPick,
    resultSourceDetail: sourceStatus?.type?.shortDetail ?? sourceStatus?.type?.detail ?? sourceStatus?.type?.name,
  })
}

function winnerPick(home?: EspnCompetitor, away?: EspnCompetitor): Extract<BetPick, "HOME" | "AWAY"> | undefined {
  if (home?.winner === true) return "HOME"
  if (away?.winner === true) return "AWAY"
  return undefined
}

function calculateScorePick(homeScore: number, awayScore: number): BetPick {
  if (homeScore > awayScore) return "HOME"
  if (homeScore < awayScore) return "AWAY"
  return "DRAW"
}

function shootoutNumber(score?: number | string) {
  if (score === undefined || score === "") return undefined
  const value = Number(score)
  return Number.isFinite(value) ? value : undefined
}

function teamName(competitor?: EspnCompetitor) {
  return (
    competitor?.team?.displayName ??
    competitor?.team?.shortDisplayName ??
    competitor?.team?.name
  )
}

function groupNameFromNote(note?: string) {
  const match = note?.match(/\bGroup\s+([A-L])\b/i)
  return match ? `Group ${match[1].toUpperCase()}` : undefined
}

function areTeamsConfirmed(homeTeam: string, awayTeam: string) {
  return !isPlaceholderTeam(homeTeam) && !isPlaceholderTeam(awayTeam)
}

function isPlaceholderTeam(team: string) {
  return /^(tbd|winner|loser|w\d+|l\d+|runner-up|third place|group\s+[a-l])/i.test(team.trim())
}

function fixtureFields(fixture: NormalizedWorldCupFixture) {
  return {
    externalId: fixture.externalId,
    source: fixture.source,
    sourceUpdatedAt: fixture.sourceUpdatedAt,
    matchNumber: fixture.matchNumber,
    venueName: fixture.venueName,
    hostCity: fixture.hostCity,
    teamsConfirmed: fixture.teamsConfirmed,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeTeamCode: fixture.homeTeamCode,
    awayTeamCode: fixture.awayTeamCode,
    groupName: fixture.groupName,
    stage: fixture.stage,
    kickoffAt: fixture.kickoffAt,
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    homeShootoutScore: fixture.homeShootoutScore,
    awayShootoutScore: fixture.awayShootoutScore,
    resultPick: fixture.resultPick,
    resultSourceDetail: fixture.resultSourceDetail,
  }
}

function toFirestoreData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Date ? Timestamp.fromDate(value) : value,
    ]),
  )
}

function removeUndefined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

function toMillis(value: MatchDoc["kickoffAt"] | Date | undefined) {
  if (!value) return undefined
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === "function") return value.toMillis()
  if (typeof value.seconds === "number") return value.seconds * 1000
  return undefined
}

function hasScores(fixture: NormalizedWorldCupFixture) {
  return fixture.homeScore !== undefined && fixture.awayScore !== undefined
}
