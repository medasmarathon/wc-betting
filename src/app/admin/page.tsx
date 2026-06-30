"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { StatusBadge } from "@/components/status-badge"

const SCHEDULE_SYNC_INTERVAL_MS = 60 * 60 * 1000

type Match = { id: string; homeTeam: string; awayTeam: string; status: string }
type User = { id: string; displayName: string; balance: number; role: string; isActive: boolean }
type AuditLog = { id: string; action: string; entityType: string; actorEmail?: string }
type ScheduleSyncResponse = {
  sync?: { source?: string; created?: number; updated?: number; skipped?: number; failed?: number }
  locked?: number
  normalizedStakes?: { adjusted?: number; skipped?: number; failed?: number }
  repairedBets?: { repaired?: number; failed?: number }
  automaticLosses?: { applied?: number; skipped?: number; failed?: number }
  settlement?: { settled?: number; updated?: number; skipped?: number; failed?: number }
}
type ScheduleSyncError = { error?: string; retryAfterSeconds?: number; nextAllowedAt?: string }

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
  const [scheduleSyncPending, setScheduleSyncPending] = useState(false)
  const [scheduleSyncMessage, setScheduleSyncMessage] = useState<string | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const scheduleSyncInFlight = useRef(false)

  const load = useCallback(async () => {
    try {
      const [matchJson, userJson, logJson] = await Promise.all([
      apiFetch("/api/matches?view=all").then((response) => response.json()),
      apiFetch("/api/admin/users").then((response) => response.json()),
      apiFetch("/api/admin/audit-log").then((response) => response.json()),
      ])

      setMatches(matchJson.matches ?? [])
      setUsers(userJson.users ?? [])
      setLogs(logJson.logs ?? [])
    } finally {
      setLoadingDashboard(false)
    }
  }, [apiFetch])

  useEffect(() => {
    void load()
  }, [load])

  const triggerScheduleSync = useCallback(async () => {
    if (scheduleSyncInFlight.current) return
    scheduleSyncInFlight.current = true
    setScheduleSyncPending(true)

    try {
      const response = await apiFetch("/api/cron/sync-schedule")
      const json = (await response.json().catch(() => ({}))) as ScheduleSyncResponse & ScheduleSyncError

      if (!response.ok) {
        setScheduleSyncMessage(formatScheduleSyncError(json))
        return
      }

      setScheduleSyncMessage(formatScheduleSyncSuccess(json))
      load()
    } finally {
      scheduleSyncInFlight.current = false
      setScheduleSyncPending(false)
    }
  }, [apiFetch, load])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void triggerScheduleSync()
    }, SCHEDULE_SYNC_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [triggerScheduleSync])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-3xl font-black">Admin</h1>
        <div className="flex flex-wrap gap-2">
          <button className="button secondary" type="button" onClick={triggerScheduleSync} disabled={scheduleSyncPending}>
            {scheduleSyncPending ? "Syncing..." : "Sync schedule"}
          </button>
          <Link className="button" href="/admin/matches">
            Manage matches
          </Link>
          <Link className="button secondary" href="/admin/bets">
            View all bets
          </Link>
          <Link className="button secondary" href="/admin/users">
            Manage users
          </Link>
        </div>
      </div>
      {scheduleSyncMessage ? <div className="panel p-3 text-sm">{scheduleSyncMessage}</div> : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <h2 className="page-title font-black">Matches needing action</h2>
          <div className="mt-3 grid gap-2">
            {loadingDashboard ? (
              <DashboardPanelSkeleton rows={4} />
            ) : (
              matches
              .filter((match) => ["COMPLETED", "LOCKED"].includes(match.status))
              .slice(0, 6)
              .map((match) => (
                <div key={match.id} className="flex justify-between gap-2 text-sm">
                  <span>{match.homeTeam} vs {match.awayTeam}</span>
                  <StatusBadge status={match.status} />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="page-title font-black">Users</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {loadingDashboard ? (
              <DashboardPanelSkeleton rows={5} />
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex justify-between gap-2">
                  <span>{user.displayName}</span>
                  <span>{user.balance} pts</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="page-title font-black">Recent audit</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {loadingDashboard ? (
              <DashboardPanelSkeleton rows={5} />
            ) : (
              logs.slice(0, 8).map((log) => (
                <div key={log.id}>
                  <b>{log.action}</b> <span className="text-muted">{log.actorEmail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function DashboardPanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-2" role="status" aria-label="Loading admin data">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex justify-between gap-3" aria-hidden="true">
          <div className="skeleton-line h-4 w-32" />
          <div className="skeleton-line h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function formatScheduleSyncSuccess(result: ScheduleSyncResponse) {
  const sync = result.sync ?? {}
  const normalizedStakes = result.normalizedStakes ?? {}
  const repairedBets = result.repairedBets ?? {}
  const automaticLosses = result.automaticLosses ?? {}
  const settlement = result.settlement ?? {}

  return [
    `Schedule sync complete${sync.source ? ` from ${sync.source}` : ""}.`,
    `Created ${sync.created ?? 0}, updated ${sync.updated ?? 0}, skipped ${sync.skipped ?? 0}, failed ${sync.failed ?? 0}.`,
    `Locked ${result.locked ?? 0}.`,
    `Normalized stakes: adjusted ${normalizedStakes.adjusted ?? 0}, skipped ${normalizedStakes.skipped ?? 0}, failed ${normalizedStakes.failed ?? 0}.`,
    `Rechecked settled bets: reset ${repairedBets.repaired ?? 0}, failed ${repairedBets.failed ?? 0}.`,
    `Applied ${automaticLosses.applied ?? 0} automatic no-bet stakes, skipped ${automaticLosses.skipped ?? 0}, failed ${automaticLosses.failed ?? 0}.`,
    `Settled ${settlement.settled ?? 0}, updated ${settlement.updated ?? 0}, settlement failed ${settlement.failed ?? 0}.`,
  ].join(" ")
}

function formatScheduleSyncError(error: ScheduleSyncError) {
  if (error.nextAllowedAt) {
    return `Schedule sync is rate limited. Try again after ${new Date(error.nextAllowedAt).toLocaleString()}.`
  }
  if (error.retryAfterSeconds) {
    return `Schedule sync is rate limited. Try again in ${Math.ceil(error.retryAfterSeconds / 60)} minutes.`
  }
  return error.error ?? "Unable to sync schedule."
}
