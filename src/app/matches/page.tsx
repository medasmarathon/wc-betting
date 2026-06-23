"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { MatchCard } from "@/components/match-card"
import { addDaysToLocalDateKey, formatLocalDateLabel, getLocalDateKey } from "@/lib/time"

type Match = React.ComponentProps<typeof MatchCard>["match"]
type MatchView = "all" | "upcoming" | "locked" | "completed"

const MATCH_VIEWS: MatchView[] = ["all", "upcoming", "locked", "completed"]

export default function MatchesPage() {
  return (
    <AuthGate>
      <MatchesContent />
    </AuthGate>
  )
}

function MatchesContent() {
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

  const dateKeys = useMemo(() => {
    const keys = new Set<string>([todayDateKey])

    if (selectedDateKey) keys.add(selectedDateKey)
    for (const match of matches) keys.add(getLocalDateKey(match.kickoffAt))

    return [...keys].sort()
  }, [matches, selectedDateKey, todayDateKey])

  const filteredMatches = useMemo(() => {
    if (!selectedDateKey) return matches

    return matches.filter((match) => getLocalDateKey(match.kickoffAt) === selectedDateKey)
  }, [matches, selectedDateKey])
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey) : "All dates"

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
          <h1 className="text-3xl font-black">Matches</h1>
          <p className="mt-1 text-sm text-stone-600">Place one pre-kickoff bet per match.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MATCH_VIEWS.map((option) => (
            <button key={option} className={`button ${view === option ? "" : "secondary"}`} onClick={() => selectView(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <section className="panel grid gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black">Match date</h2>
            <p className="mt-1 text-sm text-stone-600">
              {selectedDateLabel} - {filteredMatches.length} {filteredMatches.length === 1 ? "match" : "matches"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="button secondary !px-3"
              aria-label="Previous day"
              disabled={!selectedDateKey}
              onClick={() => {
                if (selectedDateKey) selectDate(addDaysToLocalDateKey(selectedDateKey, -1))
              }}
            >
              {"<"}
            </button>
            <button type="button" className={`button ${selectedDateKey === todayDateKey ? "" : "secondary"}`} onClick={() => selectDate(todayDateKey)}>
              Today
            </button>
            <button
              type="button"
              className="button secondary !px-3"
              aria-label="Next day"
              disabled={!selectedDateKey}
              onClick={() => {
                if (selectedDateKey) selectDate(addDaysToLocalDateKey(selectedDateKey, 1))
              }}
            >
              {">"}
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={`button whitespace-nowrap ${selectedDateKey ? "secondary" : ""}`} onClick={() => selectDate(null)}>
            All dates
          </button>
          {dateKeys.map((dateKey) => (
            <button
              key={dateKey}
              type="button"
              className={`button whitespace-nowrap ${selectedDateKey === dateKey ? "" : "secondary"}`}
              onClick={() => selectDate(dateKey)}
            >
              {formatLocalDateLabel(dateKey)}
            </button>
          ))}
        </div>
      </section>
      {error ? <div className="panel p-4 text-red-700">{error}</div> : null}
      {filteredMatches.length ? (
        <div className="grid gap-4 md:grid-cols-2">
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
        <div className="panel p-4 text-sm text-stone-600">
          {selectedDateKey ? `No matches on ${selectedDateLabel} for this view.` : "No matches for this view."}
        </div>
      )}
    </main>
  )
}
