"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { formatKickoff } from "@/lib/time"

type Bet = {
  id: string
  matchLabel: string
  kickoffAt: string
  pick: string
  stake: number
  odds: number
  potentialPayout: number
  payout: number
  status: string
}

export default function MyBetsPage() {
  return (
    <AuthGate>
      <MyBetsContent />
    </AuthGate>
  )
}

function MyBetsContent() {
  const { apiFetch } = useAuth()
  const [status, setStatus] = useState("ALL")
  const [bets, setBets] = useState<Bet[]>([])

  useEffect(() => {
    apiFetch(`/api/my-bets?status=${status}`)
      .then((response) => response.json())
      .then((json) => setBets(json.bets ?? []))
  }, [apiFetch, status])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-black">My bets</h1>
        <div className="flex flex-wrap gap-2">
          {["ALL", "PENDING", "WON", "LOST", "VOIDED"].map((option) => (
            <button key={option} className={`button ${status === option ? "" : "secondary"}`} onClick={() => setStatus(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Kickoff</th>
              <th>Pick</th>
              <th>Stake</th>
              <th>Odds</th>
              <th>Status</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id}>
                <td className="font-bold">{bet.matchLabel}</td>
                <td>{formatKickoff(bet.kickoffAt)}</td>
                <td>{bet.pick}</td>
                <td>{bet.stake}</td>
                <td>{bet.odds.toFixed(2)}</td>
                <td>{bet.status}</td>
                <td>{bet.payout}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
