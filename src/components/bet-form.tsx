"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { TeamIdentity } from "@/components/team-identity"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { formatPickLabel, formatScoreLabel, getPickTeam } from "@/lib/team-display"
import type { BetPick } from "@/types/betting"

const PICK_OPTIONS: BetPick[] = ["HOME", "DRAW", "AWAY"]

type BetFormProps = {
  match: {
    id: string
    homeTeam: string
    awayTeam: string
    homeTeamCode?: string
    awayTeamCode?: string
    odds: { HOME: number; DRAW: number; AWAY: number }
    userBet?: {
      pick: BetPick
      stake: number
      predictedHomeScore?: number
      predictedAwayScore?: number
      status: string
    } | null
  }
  onPlaced: () => void
}

export function BetForm({ match, onPlaced }: BetFormProps) {
  const { apiFetch } = useAuth()
  const isEditing = Boolean(match.userBet)
  const [pick, setPick] = useState<BetPick>(match.userBet?.pick ?? "HOME")
  const [stake, setStake] = useState(match.userBet?.stake ?? DEFAULT_BET_STAKE)
  const [predictedHomeScore, setPredictedHomeScore] = useState(
    match.userBet?.predictedHomeScore?.toString() ?? "",
  )
  const [predictedAwayScore, setPredictedAwayScore] = useState(
    match.userBet?.predictedAwayScore?.toString() ?? "",
  )
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      const response = await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({
          matchId: match.id,
          pick,
          stake,
          predictedHomeScore: predictedHomeScore === "" ? undefined : Number(predictedHomeScore),
          predictedAwayScore: predictedAwayScore === "" ? undefined : Number(predictedAwayScore),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        setMessage(json.error ?? "Unable to save bet")
        return
      }
      const savedAction = json.action === "updated" || isEditing ? "updated" : "placed"
      setMessage(`Bet ${savedAction} on ${formatPickLabel(pick, match)}.`)
      onPlaced()
    } catch {
      setMessage("Unable to save bet")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="pick-grid">
        {PICK_OPTIONS.map((option) => {
          const pickTeam = getPickTeam(option, match)
          return (
            <button
              key={option}
              type="button"
              className="pick-card"
              aria-pressed={pick === option}
              disabled={pending}
              onClick={() => setPick(option)}
            >
              <span className="pick-card-label">
                {pickTeam ? (
                  <TeamIdentity team={pickTeam.team} teamCode={pickTeam.teamCode} compact />
                ) : (
                  <span className="team-identity team-identity-compact">
                    <span className="draw-mark" aria-hidden="true">
                      D
                    </span>
                    <span className="team-name">Draw</span>
                  </span>
                )}
              </span>
              <span className="pick-card-odds">Odds {match.odds[option]}</span>
            </button>
          )
        })}
      </div>
      <label className="grid gap-1 text-sm font-bold">
        Stake
        <input className="field" type="number" min={1} value={stake} onChange={(event) => setStake(Number(event.target.value))} />
      </label>
      <p className="text-sm text-stone-600">
        If your pick is correct, your stake is refunded. If not, it goes into the party fund.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm font-bold">
          {formatScoreLabel("home", match)}
          <input className="field" type="number" min={0} value={predictedHomeScore} onChange={(event) => setPredictedHomeScore(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          {formatScoreLabel("away", match)}
          <input className="field" type="number" min={0} value={predictedAwayScore} onChange={(event) => setPredictedAwayScore(event.target.value)} />
        </label>
      </div>
      <button className="button" disabled={pending}>
        {pending ? "Saving..." : isEditing ? "Save changes" : "Place bet"}
      </button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  )
}
