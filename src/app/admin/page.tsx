"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { StatusBadge } from "@/components/status-badge"

type Match = { id: string; homeTeam: string; awayTeam: string; status: string }
type User = { id: string; displayName: string; balance: number; role: string; isActive: boolean }
type AuditLog = { id: string; action: string; entityType: string; actorEmail?: string }

export default function AdminPage() {
  return (
    <AuthGate adminOnly>
      <AdminContent />
    </AuthGate>
  )
}

function AdminContent() {
  const { apiFetch } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch("/api/matches?view=all").then((response) => response.json()),
      apiFetch("/api/admin/users").then((response) => response.json()),
      apiFetch("/api/admin/audit-log").then((response) => response.json()),
    ]).then(([matchJson, userJson, logJson]) => {
      setMatches(matchJson.matches ?? [])
      setUsers(userJson.users ?? [])
      setLogs(logJson.logs ?? [])
    })
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Admin</h1>
        <div className="flex gap-2">
          <Link className="button" href="/admin/matches">
            Manage matches
          </Link>
          <Link className="button secondary" href="/admin/users">
            Manage users
          </Link>
        </div>
      </div>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <h2 className="font-black">Matches needing action</h2>
          <div className="mt-3 grid gap-2">
            {matches
              .filter((match) => ["COMPLETED", "LOCKED"].includes(match.status))
              .slice(0, 6)
              .map((match) => (
                <div key={match.id} className="flex justify-between gap-2 text-sm">
                  <span>{match.homeTeam} vs {match.awayTeam}</span>
                  <StatusBadge status={match.status} />
                </div>
              ))}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="font-black">Users</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {users.map((user) => (
              <div key={user.id} className="flex justify-between gap-2">
                <span>{user.displayName}</span>
                <span>{user.balance} pts</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="font-black">Recent audit</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id}>
                <b>{log.action}</b> <span className="text-stone-500">{log.actorEmail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
