"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { StatusBadge } from "@/components/status-badge"

type Match = { id: string; homeTeam: string; awayTeam: string; status: string }
type User = { id: string; displayName: string; balance: number; role: string; isActive: boolean }
type AuditLog = { id: string; action: string; entityType: string; actorEmail?: string }
const SCHEDULE_SYNC_STEPS = [
  { key: "sync", label: "Schedule import" },
  { key: "lock", label: "Expired match lock" },
  { key: "normalize-stakes", label: "Stake normalization" },
  { key: "repair-bets", label: "Settled bet repair" },
  { key: "automatic-losses", label: "Automatic no-bet losses" },
  { key: "settle", label: "Match settlement" },
] as const

type ScheduleSyncStepKey = (typeof SCHEDULE_SYNC_STEPS)[number]["key"]
type ScheduleSyncResponse = {
  sync?: { source?: string; created?: number; updated?: number; skipped?: number; failed?: number }
  locked?: number
  normalizedStakes?: { adjusted?: number; skipped?: number; failed?: number }
  repairedBets?: { repaired?: number; failed?: number }
  automaticLosses?: { applied?: number; skipped?: number; failed?: number }
  settlement?: { settled?: number; updated?: number; skipped?: number; failed?: number }
}
type ScheduleSyncStepResponse = ScheduleSyncResponse & { step?: ScheduleSyncStepKey }
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
    const result: ScheduleSyncResponse = {}

    try {
      setScheduleSyncMessage("Starting schedule sync...")

      for (const [index, syncStep] of SCHEDULE_SYNC_STEPS.entries()) {
        setScheduleSyncMessage(formatScheduleSyncProgress(result, syncStep.label))

        const response = await apiFetch(`/api/admin/sync-schedule?step=${syncStep.key}`, { method: "POST" })
        const json = (await response.json().catch(() => ({}))) as ScheduleSyncStepResponse & ScheduleSyncError

        if (!response.ok) {
          setScheduleSyncMessage(formatScheduleSyncError(json, syncStep.label))
          return
        }

        Object.assign(result, stepResultPayload(json))
        setScheduleSyncMessage(formatScheduleSyncProgress(result))

        if (index === 0) void load()
      }

      setScheduleSyncMessage(formatScheduleSyncSuccess(result))
      void load()
    } finally {
      scheduleSyncInFlight.current = false
      setScheduleSyncPending(false)
    }
  }, [apiFetch, load])

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

function stepResultPayload(response: ScheduleSyncStepResponse): ScheduleSyncResponse {
  const payload: ScheduleSyncResponse = {}
  if (response.sync !== undefined) payload.sync = response.sync
  if (response.locked !== undefined) payload.locked = response.locked
  if (response.normalizedStakes !== undefined) payload.normalizedStakes = response.normalizedStakes
  if (response.repairedBets !== undefined) payload.repairedBets = response.repairedBets
  if (response.automaticLosses !== undefined) payload.automaticLosses = response.automaticLosses
  if (response.settlement !== undefined) payload.settlement = response.settlement
  return payload
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

function formatScheduleSyncProgress(result: ScheduleSyncResponse, currentStep?: string) {
  const completed = [
    result.sync ? "Schedule import" : null,
    result.locked !== undefined ? "Expired match lock" : null,
    result.normalizedStakes ? "Stake normalization" : null,
    result.repairedBets ? "Settled bet repair" : null,
    result.automaticLosses ? "Automatic no-bet losses" : null,
    result.settlement ? "Match settlement" : null,
  ].filter(Boolean)

  return [
    completed.length ? `Completed: ${completed.join(", ")}.` : null,
    currentStep ? `Running: ${currentStep}...` : null,
  ].filter(Boolean).join(" ")
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

function formatScheduleSyncError(error: ScheduleSyncError, stepLabel?: string) {
  const prefix = stepLabel ? `${stepLabel} failed. ` : ""
  if (error.nextAllowedAt) {
    return `${prefix}Schedule sync is rate limited. Try again after ${new Date(error.nextAllowedAt).toLocaleString()}.`
  }
  if (error.retryAfterSeconds) {
    return `${prefix}Schedule sync is rate limited. Try again in ${Math.ceil(error.retryAfterSeconds / 60)} minutes.`
  }
  return `${prefix}${error.error ?? "Unable to sync schedule."}`
}
