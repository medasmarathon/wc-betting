"use client"

import { Alert, Center, Loader, LoadingOverlay, Stack, Text } from "@mantine/core"
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
    placedAt?: string
    updatedAt?: string
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
  const [loading, setLoading] = useState(true)

  const fetchMatch = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/matches/${matchId}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setError(null)
      setMatch(json.match)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load match")
    }
  }, [apiFetch, matchId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await fetchMatch()
    } finally {
      setLoading(false)
    }
  }, [fetchMatch])

  useEffect(() => {
    let cancelled = false

    apiFetch(`/api/matches/${matchId}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error)
        if (cancelled) return
        setError(null)
        setMatch(json.match)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load match")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiFetch, matchId])

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

  if (!match) {
    return (
      <main className="page">
        {loading ? (
          <Center py="xl">
            <Loader aria-label="Loading match" />
          </Center>
        ) : (
          <Alert color="red" variant="light">
            {error ?? "Unable to load match"}
          </Alert>
        )}
      </main>
    )
  }

  return (
    <main className="page grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel relative p-4 sm:p-5">
        <LoadingOverlay visible={loading} loaderProps={{ "aria-label": "Refreshing match" }} />
        <Stack gap="lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="page-title text-3xl font-black">
                <MatchupLabel
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  homeTeamCode={match.homeTeamCode}
                  awayTeamCode={match.awayTeamCode}
                />
              </h1>
              <p className="page-subtitle mt-1 text-sm">
                {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
              </p>
            </div>
            <StatusBadge status={match.status} />
          </div>
          {match.homeScore !== undefined && match.awayScore !== undefined ? (
            <div className="score-panel p-4">
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <TeamIdentity team={match.homeTeam} teamCode={match.homeTeamCode} className="page-title font-black" />
                <div className="page-title text-2xl font-black tabular-nums">
                  {match.homeScore} - {match.awayScore}
                </div>
                <TeamIdentity
                  team={match.awayTeam}
                  teamCode={match.awayTeamCode}
                  className="page-title font-black sm:justify-self-end"
                />
              </div>
            </div>
          ) : null}
        </Stack>
      </section>
      <aside className="panel p-4 sm:p-5">
        {match.userBet ? (
          <Stack gap="md">
            <div className="grid gap-2">
              <h2 className="page-title text-xl font-black">Your bet</h2>
              <p>
                <b>{formatPickLabel(match.userBet.pick, match)}</b> for <b>{match.userBet.stake}</b> points
              </p>
              <p>Status: {match.userBet.status}</p>
              <p>Refund if correct: {match.userBet.potentialPayout}</p>
              <p>Actual refund: {match.userBet.payout}</p>
              <p>Party fund contribution: {match.userBet.fundContribution ?? 0}</p>
              {match.userBet.placedAt ? <p>Placed: {formatKickoff(match.userBet.placedAt)}</p> : null}
              {match.userBet.updatedAt ? <p>Last updated: {formatKickoff(match.userBet.updatedAt)}</p> : null}
            </div>
            {match.isBettable && match.userBet.status === "PENDING" ? (
              <div className="border-t border-[var(--line)] pt-4">
                <BetForm key={match.userBet.updatedAt ?? `${match.id}-edit`} match={match} onPlaced={load} />
              </div>
            ) : null}
          </Stack>
        ) : match.isBettable ? (
          <BetForm key={`${match.id}-new`} match={match} onPlaced={load} />
        ) : (
          <Text size="sm" className="text-subtle">
            Betting is closed for this match.
          </Text>
        )}
      </aside>
    </main>
  )
}
