import { getFlagIconCode, getTeamInitials } from "@/lib/team-display"

type TeamIdentityProps = {
  team: string
  teamCode?: string
  className?: string
  compact?: boolean
}

type MatchupLabelProps = {
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  className?: string
}

export function TeamIdentity({ team, teamCode, className, compact = false }: TeamIdentityProps) {
  const flagIconCode = getFlagIconCode(teamCode)
  const rootClassName = ["team-identity", compact ? "team-identity-compact" : "", className ?? ""]
    .filter(Boolean)
    .join(" ")

  return (
    <span className={rootClassName}>
      {flagIconCode ? (
        <span className={`fi fi-${flagIconCode} team-flag`} aria-hidden="true" />
      ) : (
        <span className="team-fallback" aria-hidden="true">
          {getTeamInitials(team, teamCode)}
        </span>
      )}
      <span className="team-name">{team}</span>
    </span>
  )
}

export function MatchupLabel({
  homeTeam,
  awayTeam,
  homeTeamCode,
  awayTeamCode,
  className,
}: MatchupLabelProps) {
  return (
    <span className={["matchup-line", className ?? ""].filter(Boolean).join(" ")}>
      <TeamIdentity team={homeTeam} teamCode={homeTeamCode} />
      <span className="versus">vs</span>
      <TeamIdentity team={awayTeam} teamCode={awayTeamCode} />
    </span>
  )
}
