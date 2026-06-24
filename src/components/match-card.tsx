"use client"

import { BetForm } from "@/components/bet-form"
import { useI18n } from "@/components/language-provider"
import { StatusBadge } from "@/components/status-badge"
import { MatchupLabel } from "@/components/team-identity"
import { formatMessage, statusLabel, unitLabel } from "@/lib/i18n"
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
  const { locale, t } = useI18n()
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
            <div className="page-title font-bold">{formatKickoff(match.kickoffAt, locale)}</div>
          </div>
        </div>
        <StatusBadge status={match.status} />
      </div>
      {match.userBet ? (
        <div className="bet-summary p-3 text-sm">
          {t.bets.yourBet}: <b>{formatPickLabel(match.userBet.pick, match, locale)}</b> - <b>{unitLabel(match.userBet.stake, locale)}</b> (
          {statusLabel(match.userBet.status, locale)})
          {match.userBet.updatedAt ? (
            <span className="text-muted mt-1 block text-xs">
              {formatMessage(t.bets.lastUpdated, { date: formatKickoff(match.userBet.updatedAt, locale) })}
            </span>
          ) : null}
        </div>
      ) : null}
      {canUseInlineBetSlip ? (
        <div className="flex flex-wrap gap-2">
          <button className="button w-fit" type="button" aria-expanded={expanded} onClick={onToggleBet}>
            {expanded ? t.bets.closeSlip : canEditBet ? t.bets.edit : t.bets.place}
          </button>
        </div>
      ) : null}
      {canUseInlineBetSlip && expanded && onPlaced ? (
        <div className="border-t border-[var(--line)] pt-4">
          <BetForm key={match.userBet?.updatedAt ?? `${match.id}-new`} match={match} onPlaced={onPlaced} />
        </div>
      ) : null}
    </article>
  )
}
