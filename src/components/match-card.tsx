"use client"

import Link from "next/link"
import { BetForm } from "@/components/bet-form"
import { StatusBadge } from "@/components/status-badge"
import { MatchupLabel } from "@/components/team-identity"
import { formatPickLabel } from "@/lib/team-display"
import { formatKickoff } from "@/lib/time"
import type { BetPick } from "@/types/betting"

type MatchCardProps = {
  match: {
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
    userBet?: { pick: BetPick; stake: number; status: string } | null
  }
  expanded?: boolean
  onToggleBet?: () => void
  onPlaced?: () => void
}

export function MatchCard({ match, expanded = false, onToggleBet, onPlaced }: MatchCardProps) {
  const canPlaceInlineBet = match.isBettable && !match.userBet

  return (
    <article className="panel grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-black">
            <MatchupLabel
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeTeamCode={match.homeTeamCode}
              awayTeamCode={match.awayTeamCode}
            />
          </div>
          <div className="mt-1 text-sm text-stone-600">
            {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
          </div>
        </div>
        <StatusBadge status={match.status} />
      </div>
      {match.userBet ? (
        <div className="rounded-md bg-stone-100 p-3 text-sm">
          Your bet: <b>{formatPickLabel(match.userBet.pick, match)}</b> for <b>{match.userBet.stake}</b> points ({match.userBet.status})
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canPlaceInlineBet ? (
          <button className="button w-fit" type="button" aria-expanded={expanded} onClick={onToggleBet}>
            {expanded ? "Close bet slip" : "Place bet"}
          </button>
        ) : null}
        <Link className={`button w-fit ${canPlaceInlineBet ? "secondary" : ""}`} href={`/matches/${match.id}`}>
          Details
        </Link>
      </div>
      {canPlaceInlineBet && expanded && onPlaced ? (
        <div className="border-t border-[var(--line)] pt-4">
          <BetForm match={match} onPlaced={onPlaced} />
        </div>
      ) : null}
    </article>
  )
}
