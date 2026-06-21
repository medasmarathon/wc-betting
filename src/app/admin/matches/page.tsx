"use client"

import { useCallback, useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { StatusBadge } from "@/components/status-badge"
import { formatKickoff } from "@/lib/time"

type Match = {
  id: string
  homeTeam: string
  awayTeam: string
  groupName?: string
  stage: string
  kickoffAt: string
  status: string
  odds: { HOME: number; DRAW: number; AWAY: number }
  homeScore?: number
  awayScore?: number
  resultPick?: "HOME" | "DRAW" | "AWAY"
}

export default function AdminMatchesPage() {
  return (
    <AuthGate adminOnly>
      <AdminMatchesContent />
    </AuthGate>
  )
}

function AdminMatchesContent() {
  const { apiFetch } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    homeTeam: "",
    awayTeam: "",
    groupName: "",
    stage: "GROUP",
    kickoffAt: "",
    homeOdds: "2",
    drawOdds: "3",
    awayOdds: "2",
  })

  const load = useCallback(() => {
    apiFetch("/api/matches?view=all")
      .then((response) => response.json())
      .then((json) => setMatches(json.matches ?? []))
  }, [apiFetch])

  useEffect(() => load(), [load])

  async function createMatch(event: React.FormEvent) {
    event.preventDefault()
    const response = await apiFetch("/api/admin/matches", {
      method: "POST",
      body: JSON.stringify({
        homeTeam: form.homeTeam,
        awayTeam: form.awayTeam,
        groupName: form.groupName || undefined,
        stage: form.stage,
        kickoffAt: form.kickoffAt,
        status: "OPEN",
        odds: {
          HOME: Number(form.homeOdds),
          DRAW: Number(form.drawOdds),
          AWAY: Number(form.awayOdds),
        },
      }),
    })
    const json = await response.json()
    setMessage(response.ok ? "Match created." : json.error ?? "Unable to create match")
    if (response.ok) {
      setForm({ ...form, homeTeam: "", awayTeam: "", groupName: "", kickoffAt: "" })
      load()
    }
  }

  async function action(path: string, body?: object) {
    const response = await apiFetch(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await response.json().catch(() => ({}))
    setMessage(response.ok ? "Action complete." : json.error ?? "Action failed")
    load()
  }

  return (
    <main className="page grid gap-5">
      <h1 className="text-3xl font-black">Manage matches</h1>
      <form className="panel grid gap-3 p-4" onSubmit={createMatch}>
        <h2 className="text-xl font-black">Create match</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" placeholder="Home team" value={form.homeTeam} onChange={(event) => setForm({ ...form, homeTeam: event.target.value })} />
          <input className="field" placeholder="Away team" value={form.awayTeam} onChange={(event) => setForm({ ...form, awayTeam: event.target.value })} />
          <input className="field" placeholder="Group" value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} />
          <select className="field" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
            {["GROUP", "ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "THIRD_PLACE", "FINAL"].map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
          <input className="field" type="datetime-local" value={form.kickoffAt} onChange={(event) => setForm({ ...form, kickoffAt: event.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="field" type="number" step="0.01" value={form.homeOdds} onChange={(event) => setForm({ ...form, homeOdds: event.target.value })} />
            <input className="field" type="number" step="0.01" value={form.drawOdds} onChange={(event) => setForm({ ...form, drawOdds: event.target.value })} />
            <input className="field" type="number" step="0.01" value={form.awayOdds} onChange={(event) => setForm({ ...form, awayOdds: event.target.value })} />
          </div>
        </div>
        <button className="button w-fit">Create match</button>
        {message ? <p className="text-sm text-stone-700">{message}</p> : null}
      </form>
      <div className="grid gap-4">
        {matches.map((match) => (
          <AdminMatchRow key={match.id} match={match} action={action} />
        ))}
      </div>
    </main>
  )
}

function AdminMatchRow({
  match,
  action,
}: {
  match: Match
  action: (path: string, body?: object) => Promise<void>
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "")
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "")
  const [resultPick, setResultPick] = useState(match.resultPick ?? "")

  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">
            {match.homeTeam} vs {match.awayTeam}
          </h2>
          <p className="text-sm text-stone-600">
            {[match.groupName, match.stage, formatKickoff(match.kickoffAt)].filter(Boolean).join(" • ")}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>
      <div className="grid gap-2 md:grid-cols-[100px_100px_140px_auto]">
        <input className="field" type="number" min={0} placeholder="Home" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
        <input className="field" type="number" min={0} placeholder="Away" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
        <select className="field" value={resultPick} onChange={(event) => setResultPick(event.target.value)}>
          <option value="">Auto result</option>
          <option value="HOME">Home wins</option>
          <option value="DRAW">Draw</option>
          <option value="AWAY">Away wins</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <button className="button secondary" onClick={() => action(`/api/admin/matches/${match.id}/lock`)}>
            Lock
          </button>
          <button className="button" onClick={() => action(`/api/admin/matches/${match.id}/result`, { homeScore: Number(homeScore), awayScore: Number(awayScore), resultPick: resultPick || undefined })}>
            Enter result
          </button>
          <button className="button" onClick={() => action(`/api/admin/matches/${match.id}/settle`)}>
            Settle
          </button>
          <button className="button danger" onClick={() => action(`/api/admin/matches/${match.id}/void`)}>
            Void
          </button>
        </div>
      </div>
    </article>
  )
}
