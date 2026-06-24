"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { LeaderboardTable } from "@/components/leaderboard-table"

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <LeaderboardContent />
    </AuthGate>
  )
}

function LeaderboardContent() {
  const { apiFetch } = useAuth()
  const [rows, setRows] = useState([])
  const [confirmedFundTotal, setConfirmedFundTotal] = useState(0)

  useEffect(() => {
    Promise.all([apiFetch("/api/leaderboard"), apiFetch("/api/fund")])
      .then(async ([leaderboardResponse, fundResponse]) => {
        const [leaderboardJson, fundJson] = await Promise.all([
          leaderboardResponse.json(),
          fundResponse.json(),
        ])
        setRows(leaderboardJson.leaderboard ?? [])
        setConfirmedFundTotal(fundJson.confirmedFundTotal ?? 0)
      })
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title text-3xl font-black">Leaderboard</h1>
        <div className="panel px-4 py-3">
          <div className="page-subtitle text-sm font-bold">Party fund</div>
          <div className="page-title text-2xl font-black">{confirmedFundTotal}</div>
        </div>
      </div>
      <LeaderboardTable rows={rows} />
    </main>
  )
}
