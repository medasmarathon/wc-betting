"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { DateFilter } from "@/components/date-filter"
import { useI18n } from "@/components/language-provider"
import { MatchCard } from "@/components/match-card"
import { formatMessage } from "@/lib/i18n"
import { formatLocalDateLabel, getLocalDateKey } from "@/lib/time"

type Match = React.ComponentProps<typeof MatchCard>["match"]
type MatchView = "all" | "upcoming" | "locked" | "completed"

const MAX_TIMEOUT_MS = 2_147_483_647
const MATCH_VIEWS: MatchView[] = ["all", "upcoming", "locked", "completed"]

export default function MatchesPage() {
  return (
    <AuthGate>
      <MatchesContent />
    </AuthGate>
  )
}

function MatchesContent() {
  const { locale, t } = useI18n()
  const { apiFetch } = useAuth()
  const [view, setView] = useState<MatchView>("all")
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => getLocalDateKey(new Date()))
  const [matches, setMatches] = useState<Match[]>([])
  const [loadedView, setLoadedView] = useState<MatchView | null>(null)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const latestRequestId = useRef(0)
  const todayDateKey = getLocalDateKey(new Date())

  const load = useCallback(async (signal?: AbortSignal) => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId

    try {
      const response = await apiFetch(`/api/matches?view=${view}`, { signal })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      if (signal?.aborted || requestId !== latestRequestId.current) return

      setError(null)
      setMatches(json.matches)
      setLoadedView(view)
    } catch (caught) {
      if (signal?.aborted || requestId !== latestRequestId.current) return
      setError(caught instanceof Error ? caught.message : "Unable to load matches")
    } finally {
      if (!signal?.aborted && requestId === latestRequestId.current) setLoadingMatches(false)
    }
  }, [apiFetch, view])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => load(controller.signal))

    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const kickoffTimes = matches
      .filter((match) => match.isBettable)
      .map((match) => new Date(match.kickoffAt).getTime())
      .filter((kickoffMs) => Number.isFinite(kickoffMs))
    if (!kickoffTimes.length) return

    const nextKickoffMs = Math.min(...kickoffTimes)
    const timeoutId = window.setTimeout(() => {
      const now = Date.now()
      setMatches((current) =>
        current.map((match) => {
          const kickoffMs = new Date(match.kickoffAt).getTime()
          if (!match.isBettable || !Number.isFinite(kickoffMs) || now < kickoffMs) return match

          return {
            ...match,
            isBettable: false,
            status: ["SCHEDULED", "OPEN"].includes(match.status) ? "LOCKED" : match.status,
          }
        }),
      )
      setLoadingMatches(true)
      void load()
    }, Math.max(0, Math.min(nextKickoffMs - Date.now(), MAX_TIMEOUT_MS)))

    return () => window.clearTimeout(timeoutId)
  }, [load, matches])

  const filteredMatches = useMemo(() => {
    if (loadedView !== view) return []
    if (!selectedDateKey) return matches

    return matches.filter((match) => getLocalDateKey(match.kickoffAt) === selectedDateKey)
  }, [loadedView, matches, selectedDateKey, view])
  const isLoadingCurrentView = loadingMatches && loadedView !== view
  const isRefreshingCurrentView = loadingMatches && loadedView === view
  const selectedDateLabel = selectedDateKey ? formatLocalDateLabel(selectedDateKey, locale) : t.common.allDates

  function selectView(nextView: MatchView) {
    if (nextView !== view) setLoadingMatches(true)
    setView(nextView)
    setExpandedMatchId(null)
  }

  function selectDate(nextDateKey: string | null) {
    setSelectedDateKey(nextDateKey)
    setExpandedMatchId(null)
  }

  function handleBetPlaced() {
    setExpandedMatchId(null)
    setLoadingMatches(true)
    void load()
  }

  return (
    <main className="page grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-3xl font-black">{t.matches.title}</h1>
          <p className="page-subtitle mt-1 text-sm">{t.matches.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MATCH_VIEWS.map((option) => (
            <button key={option} className={`button ${view === option ? "" : "secondary"}`} onClick={() => selectView(option)}>
              {t.matches.views[option]}
            </button>
          ))}
        </div>
      </div>
      <DateFilter
        title={t.matches.dateTitle}
        selectedDateKey={selectedDateKey}
        todayDateKey={todayDateKey}
        count={filteredMatches.length}
        singularLabel={t.matches.title.toLowerCase()}
        pluralLabel={t.matches.title.toLowerCase()}
        loadingLabel={isLoadingCurrentView ? t.matches.loading : undefined}
        onSelectDate={selectDate}
      />
      {error ? <div className="danger-text panel p-4">{error}</div> : null}
      {isRefreshingCurrentView ? (
        <div className="panel text-subtle p-3 text-sm" role="status" aria-live="polite">
          {t.matches.refreshing}
        </div>
      ) : null}
      {isLoadingCurrentView ? (
        <MatchListSkeleton label={t.matches.loading} />
      ) : filteredMatches.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              expanded={expandedMatchId === match.id}
              onToggleBet={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
              onPlaced={handleBetPlaced}
            />
          ))}
        </div>
      ) : (
        <div className="panel text-subtle p-4 text-sm">
          {selectedDateKey
            ? formatMessage(t.matches.emptyForDate, { date: selectedDateLabel })
            : t.matches.empty}
        </div>
      )}
    </main>
  )
}

function MatchListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite">
      <div className="panel text-subtle p-4 text-sm">{label}</div>
      <div className="grid items-start gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <MatchCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function MatchCardSkeleton() {
  return (
    <article className="panel grid gap-4 p-4" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3">
          <div className="skeleton-line h-6 w-3/4" />
          <div className="grid gap-2">
            <div className="skeleton-line h-4 w-1/2" />
            <div className="skeleton-line h-4 w-2/5" />
          </div>
        </div>
        <div className="skeleton-line h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton-line h-11 w-28" />
    </article>
  )
}
