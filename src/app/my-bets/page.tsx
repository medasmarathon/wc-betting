"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { DateFilter } from "@/components/date-filter"
import { useI18n } from "@/components/language-provider"
import { TableSkeleton } from "@/components/loading-state"
import { StatusBadge } from "@/components/status-badge"
import { TeamIdentity } from "@/components/team-identity"
import { formatMessage, statusLabel, unitLabel, type Locale } from "@/lib/i18n"
import { formatPickLabel, teamsFromBet } from "@/lib/team-display"
import { formatKickoff, formatLocalDateLabel, getLocalDateKey } from "@/lib/time"
import type { BetPick } from "@/types/betting"

type Bet = {
  id: string
  userDisplayName?: string
  userEmail?: string
  matchLabel: string
  homeTeam?: string
  awayTeam?: string
  homeTeamCode?: string
  awayTeamCode?: string
  kickoffAt: string
  pick: BetPick
  stake: number
  potentialPayout: number
  payout: number
  fundContribution?: number
  status: string
  placedAt?: string
  updatedAt?: string
  matchStatus?: string
  homeScore?: number
  awayScore?: number
  resultPick?: BetPick
}

export default function MyBetsPage() {
  return (
    <AuthGate>
      <MyBetsContent />
    </AuthGate>
  )
}

function MyBetsContent() {
  const { locale, t } = useI18n()
  const { apiFetch, profile } = useAuth()
  const [bets, setBets] = useState<Bet[]>([])
  const [loadingBets, setLoadingBets] = useState(true)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => getLocalDateKey(new Date()))
  const todayDateKey = getLocalDateKey(new Date())
  const isAdmin = profile?.role === "ADMIN"

  useEffect(() => {
    let cancelled = false

    apiFetch(`/api/my-bets${isAdmin ? "?scope=all" : ""}`)
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setBets(json.bets ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoadingBets(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiFetch, isAdmin])

  const filteredBets = useMemo(() => {
    if (!selectedDateKey) return bets

    return bets.filter((bet) => getLocalDateKey(bet.kickoffAt) === selectedDateKey)
  }, [bets, selectedDateKey])
  const dateEmptySuffix = selectedDateKey
    ? formatMessage(t.bets.onDate, { date: formatLocalDateLabel(selectedDateKey, locale) })
    : ""

  const pendingBets = filteredBets.filter((bet) => bet.status === "PENDING")
  const previousBets = filteredBets.filter((bet) => bet.status !== "PENDING")

  return (
    <main className="page grid gap-5">
      <div>
        <h1 className="page-title text-3xl font-black">{isAdmin ? t.myBets.allTitle : t.myBets.title}</h1>
        <p className="page-subtitle mt-1 text-sm">{t.myBets.subtitle}</p>
      </div>
      <DateFilter
        title={t.matches.dateTitle}
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        count={filteredBets.length}
        singularLabel={t.table.bets.toLowerCase()}
        pluralLabel={t.table.bets.toLowerCase()}
        loadingLabel={loadingBets ? t.bets.loading : undefined}
        onSelectDate={setSelectedDateKey}
      />
      {loadingBets ? (
        <TableSkeleton label={t.bets.loading} rows={4} columns={10} />
      ) : (
        <>
          <BetTable title={t.bets.pendingTitle} bets={pendingBets} empty={formatMessage(t.bets.emptyPending, { suffix: dateEmptySuffix })} showUser={isAdmin} />
          <BetTable title={t.bets.previousTitle} bets={previousBets} empty={formatMessage(t.bets.emptySettled, { suffix: dateEmptySuffix })} showUser={isAdmin} />
        </>
      )}
    </main>
  )
}

function BetTable({ title, bets, empty, showUser = false }: { title: string; bets: Bet[]; empty: string; showUser?: boolean }) {
  const { locale, t } = useI18n()
  const columnCount = showUser ? 11 : 10

  return (
    <section className="grid gap-3">
      <h2 className="page-title text-xl font-black">{title}</h2>
      <div className="panel table-shell">
        <table className="table">
          <thead>
            <tr>
              {showUser ? <th>{t.table.user}</th> : null}
              <th>{t.table.match}</th>
              <th>{t.table.kickoff}</th>
              <th>{t.table.pick}</th>
              <th>{t.table.stake}</th>
              <th>{t.table.result}</th>
              <th>{t.table.status}</th>
              <th>{t.table.placed}</th>
              <th>{t.table.updated}</th>
              <th>{t.table.refund}</th>
              <th>{t.table.fund}</th>
            </tr>
          </thead>
          <tbody>
            {bets.length ? (
              bets.map((bet) => {
                const teams = teamsFromBet(bet, locale)
                return (
                  <tr key={bet.id}>
                    {showUser ? (
                      <td data-label={t.table.user}>
                        <div className="grid min-w-0 gap-1">
                          <span className="page-title font-bold">{bet.userDisplayName ?? bet.userEmail ?? "Unknown user"}</span>
                          {bet.userEmail ? <span className="text-muted text-xs">{bet.userEmail}</span> : null}
                        </div>
                      </td>
                    ) : null}
                    <td data-label={t.table.match} className="page-title font-bold">
                      <div className="grid min-w-0 gap-1">
                        <TeamIdentity team={teams.homeTeam} teamCode={teams.homeTeamCode} compact />
                        <span className="text-muted text-xs font-bold uppercase">vs</span>
                        <TeamIdentity team={teams.awayTeam} teamCode={teams.awayTeamCode} compact />
                      </div>
                    </td>
                    <td data-label={t.table.kickoff}>{formatKickoff(bet.kickoffAt, locale)}</td>
                    <td data-label={t.table.pick}>{formatPickLabel(bet.pick, teams, locale)}</td>
                    <td data-label={t.table.stake}>{unitLabel(bet.stake, locale)}</td>
                    <td data-label={t.table.result}>{formatResult(bet, teams, locale, t.common.tbd)}</td>
                    <td data-label={t.table.status}><StatusBadge status={bet.status} /></td>
                    <td data-label={t.table.placed}>{bet.placedAt ? formatKickoff(bet.placedAt, locale) : ""}</td>
                    <td data-label={t.table.updated}>{bet.updatedAt ? formatKickoff(bet.updatedAt, locale) : ""}</td>
                    <td data-label={t.table.refund}>{unitLabel(bet.payout, locale)}</td>
                    <td data-label={t.table.fund}>{unitLabel(bet.fundContribution ?? 0, locale)}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columnCount} className="table-empty text-subtle">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatResult(bet: Bet, teams: ReturnType<typeof teamsFromBet>, locale: Locale, tbd: string) {
  if (bet.homeScore === undefined || bet.awayScore === undefined) return bet.matchStatus ? statusLabel(bet.matchStatus, locale) : tbd
  const winner = bet.resultPick ? ` (${formatPickLabel(bet.resultPick, teams, locale)})` : ""
  return `${bet.homeScore} - ${bet.awayScore}${winner}`
}
