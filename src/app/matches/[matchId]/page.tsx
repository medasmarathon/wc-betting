"use client"

import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { BetForm } from "@/components/bet-form"
import { StatusBadge } from "@/components/status-badge"
import { formatKickoff } from "@/lib/time"

const MAX_TIMEOUT_MS = 2_147_483_647

type MatchDetail = {
  id: string
  homeTeam: string
  awayTeam: string
  groupName?: string
  stage: string
  kickoffAt: string
  status: string
  odds: { HOME: number; DRAW: number; AWAY: number }
  isBettable: boolean
  homeScore?: number
  awayScore?: number
  userBet?: {
    pick: string
    stake: number
    odds: number
    potentialPayout: number
    payout: number
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
              {match.homeTeam} vs {match.awayTeam}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
            </p>
          </div>
          <StatusBadge status={match.status} />
        </div>
        {match.homeScore !== undefined && match.awayScore !== undefined ? (
          <div className="rounded-md bg-stone-100 p-4 text-2xl font-black">
            {match.homeScore} - {match.awayScore}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <div className="panel p-3 text-center font-bold">HOME {match.odds.HOME.toFixed(2)}</div>
          <div className="panel p-3 text-center font-bold">DRAW {match.odds.DRAW.toFixed(2)}</div>
          <div className="panel p-3 text-center font-bold">AWAY {match.odds.AWAY.toFixed(2)}</div>
        </div>
      </section>
      <aside className="panel h-fit p-5">
        {match.userBet ? (
          <div className="grid gap-2">
            <h2 className="text-xl font-black">Your bet</h2>
            <p>
              <b>{match.userBet.pick}</b> for <b>{match.userBet.stake}</b> points at{" "}
              <b>{match.userBet.odds.toFixed(2)}</b>
            </p>
            <p>Status: {match.userBet.status}</p>
            <p>Potential payout: {match.userBet.potentialPayout}</p>
            <p>Actual payout: {match.userBet.payout}</p>
          </div>
        ) : match.isBettable ? (
          <BetForm matchId={match.id} odds={match.odds} onPlaced={load} />
        ) : (
          <p className="text-sm text-stone-600">Betting is closed for this match.</p>
        )}
      </aside>
    </main>
  )
}
