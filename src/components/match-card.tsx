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
    isBettable: boolean
    userBet?: {
      pick: BetPick
      stake: number
      status: string
      updatedAt?: string
    } | null
  }
  expanded?: boolean
  onToggleBet?: () => void
  onPlaced?: () => void
}

export function MatchCard({ match, expanded = false, onToggleBet, onPlaced }: MatchCardProps) {
  const canEditBet = match.isBettable && match.userBet?.status === "PENDING"
  const canUseInlineBetSlip = match.isBettable && (!match.userBet || canEditBet)

  return (
    <article className="panel grid self-start gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="page-title text-xl font-black">
            <MatchupLabel
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeTeamCode={match.homeTeamCode}
              awayTeamCode={match.awayTeamCode}
            />
          </div>
          <div className="mt-2 grid gap-1 text-sm">
            <div className="match-card-meta font-medium">{[match.groupName, match.stage].filter(Boolean).join(" - ")}</div>
            <div className="page-title font-bold">{formatKickoff(match.kickoffAt)}</div>
          </div>
        </div>
        <StatusBadge status={match.status} />
      </div>
      {match.userBet ? (
        <div className="bet-summary p-3 text-sm">
          Your bet: <b>{formatPickLabel(match.userBet.pick, match)}</b> for <b>{match.userBet.stake}</b> points ({match.userBet.status})
          {match.userBet.updatedAt ? (
            <span className="text-muted mt-1 block text-xs">Last updated {formatKickoff(match.userBet.updatedAt)}</span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canUseInlineBetSlip ? (
          <button className="button w-fit" type="button" aria-expanded={expanded} onClick={onToggleBet}>
            {expanded ? "Close bet slip" : canEditBet ? "Edit bet" : "Place bet"}
          </button>
        ) : null}
        <Link className={`button w-fit ${canUseInlineBetSlip ? "secondary" : ""}`} href={`/matches/${match.id}`}>
          Details
        </Link>
      </div>
      {canUseInlineBetSlip && expanded && onPlaced ? (
        <div className="border-t border-[var(--line)] pt-4">
          <BetForm key={match.userBet?.updatedAt ?? `${match.id}-new`} match={match} onPlaced={onPlaced} />
        </div>
      ) : null}
    </article>
  )
}
