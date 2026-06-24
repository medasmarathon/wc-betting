"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { DateFilter } from "@/components/date-filter"
import { useI18n } from "@/components/language-provider"
import { MatchCard } from "@/components/match-card"
import { formatMessage } from "@/lib/i18n"
import { formatLocalDateLabel, getLocalDateKey } from "@/lib/time"

type Match = React.ComponentProps<typeof MatchCard>["match"]
type MatchView = "all" | "upcoming" | "locked" | "completed"

const MAX_TIMEOUT_MS = 2_147_483_647
const MATCH_VIEWS: MatchView[] = ["all", "upcoming", "locked", "completed"]

export default function MatchesPage() {
  return (
    <AuthGate>
      <MatchesContent />
    </AuthGate>
  )
}

function MatchesContent() {
  const { locale, t } = useI18n()
  const { apiFetch } = useAuth()
  const [view, setView] = useState<MatchView>("all")
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => getLocalDateKey(new Date()))
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const todayDateKey = getLocalDateKey(new Date())

  const load = useCallback(() => {
    apiFetch(`/api/matches?view=${view}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error)
        setError(null)
        setMatches(json.matches)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load matches"))
  }, [apiFetch, view])

  useEffect(() => load(), [load])

  useEffect(() => {
    const kickoffTimes = matches
      .filter((match) => match.isBettable)
      .map((match) => new Date(match.kickoffAt).getTime())
      .filter((kickoffMs) => Number.isFinite(kickoffMs))
    if (!kickoffTimes.length) return

    const nextKickoffMs = Math.min(...kickoffTimes)
    const timeoutId = window.setTimeout(() => {
      const now = Date.now()
      setMatches((current) =>
        current.map((match) => {
          const kickoffMs = new Date(match.kickoffAt).getTime()
          if (!match.isBettable || !Number.isFinite(kickoffMs) || now < kickoffMs) return match

          return {
            ...match,
            isBettable: false,
            status: ["SCHEDULED", "OPEN"].includes(match.status) ? "LOCKED" : match.status,
          }
        }),
      )
      load()
    }, Math.max(0, Math.min(nextKickoffMs - Date.now(), MAX_TIMEOUT_MS)))

    return () => window.clearTimeout(timeoutId)
  }, [load, matches])

  const filteredMatches = useMemo(() => {
    if (!selectedDateKey) return matches

    return matches.filter((match) => getLocalDateKey(match.kickoffAt) === selectedDateKey)
  }, [matches, selectedDateKey])
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey, locale) : t.common.allDates

  function selectView(nextView: MatchView) {
    setView(nextView)
    setExpandedMatchId(null)
  }

  function selectDate(nextDateKey: string | null) {
    setSelectedDateKey(nextDateKey)
    setExpandedMatchId(null)
  }

  function handleBetPlaced() {
    setExpandedMatchId(null)
    load()
  }

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-3xl font-black">{t.matches.title}</h1>
          <p className="page-subtitle mt-1 text-sm">{t.matches.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MATCH_VIEWS.map((option) => (
            <button key={option} className={`button ${view === option ? "" : "secondary"}`} onClick={() => selectView(option)}>
              {t.matches.views[option]}
            </button>
          ))}
        </div>
      </div>
      <DateFilter
        title={t.matches.dateTitle}
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        count={filteredMatches.length}
        singularLabel={t.matches.title.toLowerCase()}
        pluralLabel={t.matches.title.toLowerCase()}
        onSelectDate={selectDate}
      />
      {error ? <div className="danger-text panel p-4">{error}</div> : null}
      {filteredMatches.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              expanded={expandedMatchId === match.id}
              onToggleBet={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
              onPlaced={handleBetPlaced}
            />
          ))}
        </div>
      ) : (
        <div className="panel text-subtle p-4 text-sm">
          {selectedDateKey
            ? formatMessage(t.matches.emptyForDate, { date: selectedDateLabel })
            : t.matches.empty}
        </div>
      )}
    </main>
  )
}
