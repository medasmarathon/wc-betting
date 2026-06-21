"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"

type BetFormProps = {
  matchId: string
  onPlaced: () => void
}

export function BetForm({ matchId, onPlaced }: BetFormProps) {
  const { apiFetch } = useAuth()
  const [pick, setPick] = useState<"HOME" | "DRAW" | "AWAY">("HOME")
  const [stake, setStake] = useState(DEFAULT_BET_STAKE)
  const [predictedHomeScore, setPredictedHomeScore] = useState("")
  const [predictedAwayScore, setPredictedAwayScore] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const response = await apiFetch("/api/bets", {
      method: "POST",
      body: JSON.stringify({
        matchId,
        pick,
        stake,
        predictedHomeScore: predictedHomeScore === "" ? undefined : Number(predictedHomeScore),
        predictedAwayScore: predictedAwayScore === "" ? undefined : Number(predictedAwayScore),
      }),
    })
    const json = await response.json()
    setPending(false)
    if (!response.ok) {
      setMessage(json.error ?? "Unable to place bet")
      return
    }
    setMessage("Bet placed.")
    onPlaced()
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(["HOME", "DRAW", "AWAY"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`button ${pick === option ? "" : "secondary"}`}
            onClick={() => setPick(option)}
          >
            {option}
          </button>
        ))}
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
          Home score
          <input className="field" type="number" min={0} value={predictedHomeScore} onChange={(event) => setPredictedHomeScore(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Away score
          <input className="field" type="number" min={0} value={predictedAwayScore} onChange={(event) => setPredictedAwayScore(event.target.value)} />
        </label>
      </div>
      <button className="button" disabled={pending}>
        Place bet
      </button>
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </form>
  )
}
