"use client"

import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { BetForm } from "@/components/bet-form"
import { StatusBadge } from "@/components/status-badge"
import { MatchupLabel, TeamIdentity } from "@/components/team-identity"
import { formatPickLabel } from "@/lib/team-display"
import { formatKickoff } from "@/lib/time"
import type { BetPick } from "@/types/betting"

const MAX_TIMEOUT_MS = 2_147_483_647

type MatchDetail = {
  id: string
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  groupName?: string
  stage: string
  kickoffAt: string
  status: string
  odds: { HOME: number; DRAW: number; AWAY: number }
  isBettable: boolean
  homeScore?: number
  awayScore?: number
  userBet?: {
    pick: BetPick
    stake: number
    potentialPayout: number
    payout: number
    fundContribution?: number
    status: string
  } | null
}

export default function MatchDetailPage() {
  return (
    <AuthGate>
      <MatchDetailContent />
    </AuthGate>
  )
}

function MatchDetailContent() {
  const { matchId } = useParams<{ matchId: string }>()
  const { apiFetch } = useAuth()
  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch(`/api/matches/${matchId}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error)
        setError(null)
        setMatch(json.match)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load match"))
  }, [apiFetch, matchId])

  useEffect(() => load(), [load])

  useEffect(() => {
    if (!match?.isBettable) return

    const kickoffMs = new Date(match.kickoffAt).getTime()
    if (!Number.isFinite(kickoffMs)) return

    const closeBettingLocally = () => {
      setMatch((current) => {
        if (!current || current.id !== match.id) return current
        return {
          ...current,
          isBettable: false,
          status: ["SCHEDULED", "OPEN"].includes(current.status) ? "LOCKED" : current.status,
        }
      })
    }

    const delayMs = kickoffMs - Date.now()
    const timeoutId = window.setTimeout(() => {
      if (delayMs <= MAX_TIMEOUT_MS) closeBettingLocally()
      load()
    }, Math.max(0, Math.min(delayMs, MAX_TIMEOUT_MS)))

    return () => window.clearTimeout(timeoutId)
  }, [load, match?.id, match?.isBettable, match?.kickoffAt])

  if (!match) return <main className="page">{error ?? "Loading..."}</main>

  return (
    <main className="page grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="panel grid gap-5 p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">
              <MatchupLabel
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                homeTeamCode={match.homeTeamCode}
                awayTeamCode={match.awayTeamCode}
              />
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
            </p>
          </div>
          <StatusBadge status={match.status} />
        </div>
        {match.homeScore !== undefined && match.awayScore !== undefined ? (
          <div className="rounded-md bg-stone-100 p-4">
            <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <TeamIdentity team={match.homeTeam} teamCode={match.homeTeamCode} className="font-black" />
              <div className="text-2xl font-black tabular-nums">
                {match.homeScore} - {match.awayScore}
              </div>
              <TeamIdentity team={match.awayTeam} teamCode={match.awayTeamCode} className="font-black sm:justify-self-end" />
            </div>
          </div>
        ) : null}
      </section>
      <aside className="panel h-fit p-5">
        {match.userBet ? (
          <div className="grid gap-2">
            <h2 className="text-xl font-black">Your bet</h2>
            <p>
              <b>{formatPickLabel(match.userBet.pick, match)}</b> for <b>{match.userBet.stake}</b> points
            </p>
            <p>Status: {match.userBet.status}</p>
            <p>Refund if correct: {match.userBet.potentialPayout}</p>
            <p>Actual refund: {match.userBet.payout}</p>
            <p>Party fund contribution: {match.userBet.fundContribution ?? 0}</p>
          </div>
        ) : match.isBettable ? (
          <BetForm match={match} onPlaced={load} />
        ) : (
          <p className="text-sm text-stone-600">Betting is closed for this match.</p>
        )}
      </aside>
    </main>
  )
}
