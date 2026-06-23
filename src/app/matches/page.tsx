"use client"

import { useCallback, useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { MatchCard } from "@/components/match-card"

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
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)

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

  function selectView(nextView: MatchView) {
    setView(nextView)
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
      {error ? <div className="panel p-4 text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            expanded={expandedMatchId === match.id}
            onToggleBet={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
            onPlaced={handleBetPlaced}
          />
        ))}
      </div>
    </main>
  )
}
