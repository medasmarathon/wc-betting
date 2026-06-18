"use client"

import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"
import { formatKickoff } from "@/lib/time"

type MatchCardProps = {
  match: {
    id: string
    homeTeam: string
    awayTeam: string
    groupName?: string
    stage: string
    kickoffAt: string
    status: string
    odds: { HOME: number; DRAW: number; AWAY: number }
    isBettable: boolean
    userBet?: { pick: string; stake: number; status: string } | null
  }
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="panel grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-black">
            {match.homeTeam} <span className="text-stone-400">vs</span> {match.awayTeam}
          </div>
          <div className="mt-1 text-sm text-stone-600">
            {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
          </div>
        </div>
        <StatusBadge status={match.status} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md border border-[var(--line)] p-2">HOME {match.odds.HOME.toFixed(2)}</div>
        <div className="rounded-md border border-[var(--line)] p-2">DRAW {match.odds.DRAW.toFixed(2)}</div>
        <div className="rounded-md border border-[var(--line)] p-2">AWAY {match.odds.AWAY.toFixed(2)}</div>
      </div>
      {match.userBet ? (
        <div className="rounded-md bg-stone-100 p-3 text-sm">
          Your bet: <b>{match.userBet.pick}</b> for <b>{match.userBet.stake}</b> points ({match.userBet.status})
        </div>
      ) : null}
      <Link className="button w-fit" href={`/matches/${match.id}`}>
        {match.isBettable ? "Open bet slip" : "View match"}
      </Link>
    </article>
  )
}
