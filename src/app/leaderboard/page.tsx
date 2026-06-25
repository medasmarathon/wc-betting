"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { useI18n } from "@/components/language-provider"
import { TableSkeleton } from "@/components/loading-state"
import { formatMessage, unitLabel } from "@/lib/i18n"

type UserGroup = {
  id: string
  name: string
}

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <LeaderboardContent />
    </AuthGate>
  )
}

function LeaderboardContent() {
  const { locale, t } = useI18n()
  const { apiFetch } = useAuth()
  const [rows, setRows] = useState([])
  const [confirmedFundTotal, setConfirmedFundTotal] = useState(0)
  const [groupFundTotal, setGroupFundTotal] = useState<number | null>(null)
  const [userGroup, setUserGroup] = useState<UserGroup | null>(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([apiFetch("/api/leaderboard"), apiFetch("/api/fund")])
      .then(async ([leaderboardResponse, fundResponse]) => {
        const [leaderboardJson, fundJson] = await Promise.all([
          leaderboardResponse.json(),
          fundResponse.json(),
        ])
        if (cancelled) return

        setRows(leaderboardJson.leaderboard ?? [])
        setConfirmedFundTotal(fundJson.confirmedFundTotal ?? 0)
        setGroupFundTotal(typeof fundJson.groupFundTotal === "number" ? fundJson.groupFundTotal : null)
        setUserGroup(fundJson.userGroup ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoadingLeaderboard(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title text-3xl font-black">{t.leaderboard.title}</h1>
        <div className="panel px-4 py-3">
          <div className="page-subtitle text-sm font-bold">{t.leaderboard.partyFund}</div>
          {loadingLeaderboard ? (
            <div className="skeleton-line mt-1 h-8 w-24" aria-hidden="true" />
          ) : (
            <div className="page-title text-2xl font-black">{unitLabel(confirmedFundTotal, locale)}</div>
          )}
        </div>
        {userGroup ? (
          <div className="panel px-4 py-3">
            <div className="page-subtitle text-sm font-bold">
              {formatMessage(t.leaderboard.groupFund, { group: userGroup.name })}
            </div>
            <div className="page-title text-2xl font-black">{unitLabel(groupFundTotal ?? 0, locale)}</div>
          </div>
        ) : null}
      </div>
      {loadingLeaderboard ? <TableSkeleton label={t.leaderboard.loading} rows={5} columns={8} /> : <LeaderboardTable rows={rows} />}
    </main>
  )
}
