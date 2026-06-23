import type { BetPick } from "@/types/betting"

export type MatchTeams = {
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
}

type MaybePick = BetPick | string | undefined | null

const FIFA_FLAG_CODES: Record<string, string> = {
  AFG: "af",
  ALB: "al",
  ALG: "dz",
  ARG: "ar",
  ARM: "am",
  AUS: "au",
  AUT: "at",
  AZE: "az",
  BEL: "be",
  BOL: "bo",
  BIH: "ba",
  BRA: "br",
  BUL: "bg",
  CAN: "ca",
  CHI: "cl",
  CHN: "cn",
  CIV: "ci",
  CMR: "cm",
  COD: "cd",
  COL: "co",
  CRC: "cr",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  DEN: "dk",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FIN: "fi",
  FRA: "fr",
  GEO: "ge",
  GER: "de",
  GHA: "gh",
  GRE: "gr",
  HAI: "ht",
  HON: "hn",
  HUN: "hu",
  IRN: "ir",
  IRQ: "iq",
  ISL: "is",
  ISR: "il",
  ITA: "it",
  JAM: "jm",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NGA: "ng",
  NIR: "gb-nir",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  PER: "pe",
  POL: "pl",
  POR: "pt",
  QAT: "qa",
  ROU: "ro",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SRB: "rs",
  SUI: "ch",
  SVK: "sk",
  SVN: "si",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  UAE: "ae",
  UKR: "ua",
  URU: "uy",
  USA: "us",
  UZB: "uz",
  VEN: "ve",
  WAL: "gb-wls",
}

export function isBetPick(value: MaybePick): value is BetPick {
  return value === "HOME" || value === "DRAW" || value === "AWAY"
}

export function normalizeTeamCode(code?: string | null) {
  const normalized = code?.trim().toUpperCase()
  return normalized || undefined
}

export function getFlagIconCode(teamCode?: string | null) {
  const normalized = normalizeTeamCode(teamCode)
  return normalized ? FIFA_FLAG_CODES[normalized] : undefined
}

export function formatPickLabel(pick: MaybePick, teams: MatchTeams) {
  if (pick === "HOME") return teams.homeTeam
  if (pick === "AWAY") return teams.awayTeam
  if (pick === "DRAW") return "Draw"
  return pick ?? "TBD"
}

export function getPickTeam(pick: MaybePick, teams: MatchTeams) {
  if (pick === "HOME") return { team: teams.homeTeam, teamCode: teams.homeTeamCode }
  if (pick === "AWAY") return { team: teams.awayTeam, teamCode: teams.awayTeamCode }
  return null
}

export function formatScoreLabel(side: "home" | "away", teams: MatchTeams) {
  return `${side === "home" ? teams.homeTeam : teams.awayTeam} score`
}

export function getTeamInitials(team: string, fallbackCode?: string | null) {
  const words = team.match(/[A-Za-z0-9]+/g) ?? []
  if (!words.length) return normalizeTeamCode(fallbackCode)?.slice(0, 3) ?? "TBD"
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

export function teamsFromBet<T extends Partial<MatchTeams> & { matchLabel?: string }>(bet: T): MatchTeams {
  const [labelHome, labelAway] = splitMatchLabel(bet.matchLabel)
  return {
    homeTeam: bet.homeTeam ?? labelHome ?? "Home team",
    awayTeam: bet.awayTeam ?? labelAway ?? "Away team",
    homeTeamCode: bet.homeTeamCode,
    awayTeamCode: bet.awayTeamCode,
  }
}

function splitMatchLabel(matchLabel?: string) {
  if (!matchLabel) return []
  const parts = matchLabel.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean)
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(" vs ")] : []
}
