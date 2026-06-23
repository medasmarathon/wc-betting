"use client"

import { useEffect, useMemo, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { DateFilter } from "@/components/date-filter"
import { TeamIdentity } from "@/components/team-identity"
import { formatPickLabel, teamsFromBet } from "@/lib/team-display"
import { formatKickoff, formatLocalDateLabel, getLocalDateKey } from "@/lib/time"
import type { BetPick } from "@/types/betting"

type Bet = {
  id: string
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
  const { apiFetch } = useAuth()
  const [bets, setBets] = useState<Bet[]>([])
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => getLocalDateKey(new Date()))
  const todayDateKey = getLocalDateKey(new Date())

  useEffect(() => {
    apiFetch("/api/my-bets")
      .then((response) => response.json())
      .then((json) => setBets(json.bets ?? []))
  }, [apiFetch])

  const dateKeys = useMemo(() => {
    const keys = new Set<string>([todayDateKey])

    if (selectedDateKey) keys.add(selectedDateKey)
    for (const bet of bets) keys.add(getLocalDateKey(bet.kickoffAt))

    return [...keys].sort()
  }, [bets, selectedDateKey, todayDateKey])

  const filteredBets = useMemo(() => {
    if (!selectedDateKey) return bets

    return bets.filter((bet) => getLocalDateKey(bet.kickoffAt) === selectedDateKey)
  }, [bets, selectedDateKey])
  const dateEmptySuffix = selectedDateKey ? ` on ${formatLocalDateLabel(selectedDateKey)}` : ""

  const pendingBets = filteredBets.filter((bet) => bet.status === "PENDING")
  const previousBets = filteredBets.filter((bet) => bet.status !== "PENDING")

  return (
    <main className="page grid gap-5">
      <div>
        <h1 className="text-3xl font-black">My bets</h1>
        <p className="mt-1 text-sm text-stone-600">Track pending picks and settled party fund results.</p>
      </div>
      <DateFilter
        title="Match date"
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        dateKeys={dateKeys}
        count={filteredBets.length}
        singularLabel="bet"
        pluralLabel="bets"
        onSelectDate={setSelectedDateKey}
      />
      <BetTable title="Upcoming bets" bets={pendingBets} empty={`No pending bets${dateEmptySuffix}.`} />
      <BetTable title="Previous bets" bets={previousBets} empty={`No settled bets${dateEmptySuffix}.`} />
    </main>
  )
}

function BetTable({ title, bets, empty }: { title: string; bets: Bet[]; empty: string }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Kickoff</th>
              <th>Pick</th>
              <th>Stake</th>
              <th>Result</th>
              <th>Status</th>
              <th>Placed</th>
              <th>Updated</th>
              <th>Refund</th>
              <th>Fund</th>
            </tr>
          </thead>
          <tbody>
            {bets.length ? (
              bets.map((bet) => {
                const teams = teamsFromBet(bet)
                return (
                  <tr key={bet.id}>
                    <td className="font-bold">
                      <div className="grid min-w-[220px] gap-1">
                        <TeamIdentity team={teams.homeTeam} teamCode={teams.homeTeamCode} compact />
                        <span className="text-xs font-bold uppercase text-stone-400">vs</span>
                        <TeamIdentity team={teams.awayTeam} teamCode={teams.awayTeamCode} compact />
                      </div>
                    </td>
                    <td>{formatKickoff(bet.kickoffAt)}</td>
                    <td>{formatPickLabel(bet.pick, teams)}</td>
                    <td>{bet.stake}</td>
                    <td>{formatResult(bet, teams)}</td>
                    <td>{bet.status}</td>
                    <td>{bet.placedAt ? formatKickoff(bet.placedAt) : ""}</td>
                    <td>{bet.updatedAt ? formatKickoff(bet.updatedAt) : ""}</td>
                    <td>{bet.payout}</td>
                    <td>{bet.fundContribution ?? 0}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={10} className="text-stone-600">
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

function formatResult(bet: Bet, teams: ReturnType<typeof teamsFromBet>) {
  if (bet.homeScore === undefined || bet.awayScore === undefined) return bet.matchStatus ?? "TBD"
  const winner = bet.resultPick ? ` (${formatPickLabel(bet.resultPick, teams)})` : ""
  return `${bet.homeScore} - ${bet.awayScore}${winner}`
}
