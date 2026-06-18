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

  useEffect(() => {
    apiFetch("/api/leaderboard")
      .then((response) => response.json())
      .then((json) => setRows(json.leaderboard ?? []))
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <h1 className="text-3xl font-black">Leaderboard</h1>
      <LeaderboardTable rows={rows} />
    </main>
  )
}
