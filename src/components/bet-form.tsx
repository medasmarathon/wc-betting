"use client"

import { Button, Stack, Text } from "@mantine/core"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { TeamIdentity } from "@/components/team-identity"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { formatMessage, unitLabel } from "@/lib/i18n"
import { formatPickLabel, getPickTeam } from "@/lib/team-display"
import type { BetPick } from "@/types/betting"

const PICK_OPTIONS: BetPick[] = ["HOME", "DRAW", "AWAY"]

type BetFormProps = {
  match: {
    id: string
    homeTeam: string
    awayTeam: string
    homeTeamCode?: string
    awayTeamCode?: string
    userBet?: {
      pick: BetPick
      stake: number
      status: string
    } | null
  }
  onPlaced: () => void | Promise<void>
}

export function BetForm({ match, onPlaced }: BetFormProps) {
  const { locale, t } = useI18n()
  const { apiFetch } = useAuth()
  const isEditing = Boolean(match.userBet)
  const [pick, setPick] = useState<BetPick>(match.userBet?.pick ?? "HOME")
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
          stake: DEFAULT_BET_STAKE,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        setMessage(json.error ?? t.bets.saveFailed)
        return
      }
      const savedAction = json.action === "updated" || isEditing ? t.bets.updated : t.bets.placed
      setMessage(formatMessage(t.bets.saved, { action: savedAction, pick: formatPickLabel(pick, match, locale) }))
      await onPlaced()
    } catch {
      setMessage(t.bets.saveFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <div className="bet-pick-grid">
          {PICK_OPTIONS.map((option) => {
            const pickTeam = getPickTeam(option, match)
            return (
              <button
                key={option}
                type="button"
                className="bet-pick-button"
                aria-pressed={pick === option}
                disabled={pending}
                onClick={() => setPick(option)}
              >
                {pickTeam ? (
                  <TeamIdentity team={pickTeam.team} teamCode={pickTeam.teamCode} compact />
                ) : (
                  <span className="team-identity team-identity-compact">
                    <span className="draw-mark" aria-hidden="true">
                      D
                    </span>
                    <span className="team-name">{t.common.draw}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="bet-stake-card px-3 py-2">
          <Text size="sm" fw={700}>
            {t.bets.stake}
          </Text>
          <Text fw={800}>{unitLabel(DEFAULT_BET_STAKE, locale)}</Text>
        </div>
        <Text size="sm" className="text-subtle">
          {t.bets.stakeNote}
        </Text>
        <Button type="submit" loading={pending}>
          {isEditing ? t.bets.save : t.bets.place}
        </Button>
        {message ? (
          <Text size="sm" className="text-subtle">
            {message}
          </Text>
        ) : null}
      </Stack>
    </form>
  )
}
