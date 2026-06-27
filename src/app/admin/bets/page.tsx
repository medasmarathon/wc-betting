"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { DateFilter } from "@/components/date-filter"
import { useI18n } from "@/components/language-provider"
import { TableSkeleton } from "@/components/loading-state"
import { DEFAULT_PAGE_SIZE, PaginationControls, pageCountFor, pageItems } from "@/components/pagination-controls"
import { StatusBadge } from "@/components/status-badge"
import { TeamIdentity } from "@/components/team-identity"
import { statusLabel, unitLabel, type Locale } from "@/lib/i18n"
import { formatPickLabel, teamsFromBet } from "@/lib/team-display"
import { formatKickoff, getLocalDateKey } from "@/lib/time"
import type { BetPick, BetStatus } from "@/types/betting"

type AdminBet = {
  id: string
  userId: string
  userDisplayName?: string
  userEmail?: string
  groupName?: string
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
  status: BetStatus
  placedAt?: string
  updatedAt?: string
  settledAt?: string
  matchStatus?: string
  homeScore?: number
  awayScore?: number
  resultPick?: BetPick
}

const STATUS_FILTERS = ["ALL", "PENDING", "WON", "LOST", "VOIDED"] as const

export default function AdminBetsPage() {
  return (
    <AuthGate adminOnly>
      <AdminBetsContent />
    </AuthGate>
  )
}

function AdminBetsContent() {
  const { apiFetch } = useAuth()
  const { locale } = useI18n()
  const [bets, setBets] = useState<AdminBet[]>([])
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL")
  const [selectedUserId, setSelectedUserId] = useState("ALL")
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [loadingBets, setLoadingBets] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const todayDateKey = getLocalDateKey(new Date())

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/bets")
      const json = await response.json().catch(() => ({}))

      if (!response.ok) {
        setMessage(json.error ?? "Unable to load bets.")
        setBets([])
        return
      }

      setMessage(null)
      setBets(json.bets ?? [])
    } finally {
      setLoadingBets(false)
    }
  }, [apiFetch])

  const refresh = useCallback(() => {
    setLoadingBets(true)
    void load()
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  const userOptions = useMemo(() => {
    const usersById = new Map<string, { id: string; label: string }>()

    for (const bet of bets) {
      if (!bet.userId) continue
      usersById.set(bet.userId, {
        id: bet.userId,
        label: bet.userDisplayName ?? bet.userEmail ?? "Unknown user",
      })
    }

    return Array.from(usersById.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [bets])

  const filteredBets = useMemo(() => {
    return bets.filter((bet) => {
      if (statusFilter !== "ALL" && bet.status !== statusFilter) return false
      if (selectedUserId !== "ALL" && bet.userId !== selectedUserId) return false
      if (selectedDateKey && getLocalDateKey(bet.kickoffAt) !== selectedDateKey) return false
      return true
    })
  }, [bets, selectedDateKey, selectedUserId, statusFilter])

  const pageCount = pageCountFor(filteredBets.length)
  const currentPage = Math.min(page, pageCount)
  const visibleBets = useMemo(() => pageItems(filteredBets, currentPage), [currentPage, filteredBets])

  const summary = useMemo(() => {
    return bets.reduce(
      (totals, bet) => {
        totals.total += 1
        totals.staked += bet.stake
        totals[bet.status] += 1
        return totals
      },
      { total: 0, staked: 0, PENDING: 0, WON: 0, LOST: 0, VOIDED: 0 } satisfies Record<BetStatus, number> & {
        total: number
        staked: number
      },
    )
  }, [bets])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-3xl font-black">User bets</h1>
          <p className="page-subtitle mt-1 text-sm">
            Review each user&apos;s selected outcome, stake, status, and settlement details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field min-w-48"
            aria-label="Filter bets by user"
            value={selectedUserId}
            onChange={(event) => {
              setSelectedUserId(event.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">All users</option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
          <select
            className="field min-w-40"
            aria-label="Filter bets by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])
              setPage(1)
            }}
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : statusLabel(status, locale)}
              </option>
            ))}
          </select>
          <button className="button secondary" type="button" onClick={refresh} disabled={loadingBets}>
            {loadingBets ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {message ? <div className="panel p-3 text-sm text-subtle">{message}</div> : null}

      <DateFilter
        title="Match date"
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        count={filteredBets.length}
        singularLabel="bet"
        pluralLabel="bets"
        loadingLabel={loadingBets ? "Loading user bets..." : undefined}
        onSelectDate={(dateKey) => {
          setSelectedDateKey(dateKey)
          setPage(1)
        }}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryTile label="Total bets" value={summary.total.toString()} />
        <SummaryTile label="Total staked" value={unitLabel(summary.staked, locale)} />
        <SummaryTile label="Pending" value={summary.PENDING.toString()} />
        <SummaryTile label="Won" value={summary.WON.toString()} />
        <SummaryTile label="Lost / voided" value={`${summary.LOST} / ${summary.VOIDED}`} />
      </section>

      {loadingBets ? (
        <TableSkeleton label="Loading user bets..." rows={6} columns={12} />
      ) : (
        <AdminBetTable
          bets={visibleBets}
          locale={locale}
          pagination={
            <PaginationControls
              label="Bets"
              page={currentPage}
              pageCount={pageCount}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredBets.length}
              onPageChange={setPage}
            />
          }
        />
      )}
    </main>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="page-subtitle text-xs font-bold uppercase">{label}</div>
      <div className="page-title mt-1 text-xl font-black">{value}</div>
    </div>
  )
}

function AdminBetTable({ bets, locale, pagination }: { bets: AdminBet[]; locale: Locale; pagination: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title text-xl font-black">Bet details</h2>
        {pagination}
      </div>
      <div className="panel table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Match</th>
              <th>Kickoff</th>
              <th>Selected outcome</th>
              <th>Stake</th>
              <th>Potential refund</th>
              <th>Bet status</th>
              <th>Match result</th>
              <th>Refund</th>
              <th>Fund</th>
              <th>Placed</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {bets.length ? (
              bets.map((bet) => {
                const teams = teamsFromBet(bet, locale)

                return (
                  <tr key={bet.id}>
                    <td data-label="User">
                      <div className="grid min-w-0 gap-1">
                        <span className="page-title font-bold">{bet.userDisplayName ?? bet.userEmail ?? "Unknown user"}</span>
                        {bet.userEmail ? <span className="text-muted text-xs">{bet.userEmail}</span> : null}
                        {bet.groupName ? <span className="text-muted text-xs">Group: {bet.groupName}</span> : null}
                      </div>
                    </td>
                    <td data-label="Match" className="page-title font-bold">
                      <div className="grid min-w-0 gap-1">
                        <TeamIdentity team={teams.homeTeam} teamCode={teams.homeTeamCode} compact />
                        <span className="text-muted text-xs font-bold uppercase">vs</span>
                        <TeamIdentity team={teams.awayTeam} teamCode={teams.awayTeamCode} compact />
                      </div>
                    </td>
                    <td data-label="Kickoff">{formatKickoff(bet.kickoffAt, locale)}</td>
                    <td data-label="Selected outcome">{formatPickLabel(bet.pick, teams, locale)}</td>
                    <td data-label="Stake">{unitLabel(bet.stake, locale)}</td>
                    <td data-label="Potential refund">{unitLabel(bet.potentialPayout, locale)}</td>
                    <td data-label="Bet status">
                      <StatusBadge status={bet.status} />
                    </td>
                    <td data-label="Match result">{formatResult(bet, teams, locale)}</td>
                    <td data-label="Refund">{unitLabel(bet.payout, locale)}</td>
                    <td data-label="Fund">{unitLabel(bet.fundContribution ?? 0, locale)}</td>
                    <td data-label="Placed">{bet.placedAt ? formatKickoff(bet.placedAt, locale) : ""}</td>
                    <td data-label="Updated">{bet.updatedAt ? formatKickoff(bet.updatedAt, locale) : ""}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={12} className="table-empty text-subtle">
                  No bets match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatResult(bet: AdminBet, teams: ReturnType<typeof teamsFromBet>, locale: Locale) {
  if (bet.homeScore === undefined || bet.awayScore === undefined) {
    return bet.matchStatus ? statusLabel(bet.matchStatus, locale) : "TBD"
  }

  const winner = bet.resultPick ? ` (${formatPickLabel(bet.resultPick, teams, locale)})` : ""
  return `${bet.homeScore} - ${bet.awayScore}${winner}`
}
