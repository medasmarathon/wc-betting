"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { MatchCard } from "@/components/match-card"

type Match = React.ComponentProps<typeof MatchCard>["match"]

export default function MatchesPage() {
  return (
    <AuthGate>
      <MatchesContent />
    </AuthGate>
  )
}

function MatchesContent() {
  const { apiFetch } = useAuth()
  const [view, setView] = useState("all")
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/api/matches?view=${view}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error)
        setMatches(json.matches)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load matches"))
  }, [apiFetch, view])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Matches</h1>
          <p className="mt-1 text-sm text-stone-600">Place one pre-kickoff bet per match.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "upcoming", "locked", "completed"].map((option) => (
            <button key={option} className={`button ${view === option ? "" : "secondary"}`} onClick={() => setView(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="panel p-4 text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </main>
  )
}
