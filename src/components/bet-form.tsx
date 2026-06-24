"use client"

import { Button, Group, Stack, Text, TextInput } from "@mantine/core"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { TeamIdentity } from "@/components/team-identity"
import { DEFAULT_BET_STAKE } from "@/lib/bet-settings"
import { formatPickLabel, formatScoreLabel, getPickTeam } from "@/lib/team-display"
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
      predictedHomeScore?: number
      predictedAwayScore?: number
      status: string
    } | null
  }
  onPlaced: () => void | Promise<void>
}

export function BetForm({ match, onPlaced }: BetFormProps) {
  const { apiFetch } = useAuth()
  const isEditing = Boolean(match.userBet)
  const [pick, setPick] = useState<BetPick>(match.userBet?.pick ?? "HOME")
  const [predictedHomeScore, setPredictedHomeScore] = useState(
    match.userBet?.predictedHomeScore?.toString() ?? "",
  )
  const [predictedAwayScore, setPredictedAwayScore] = useState(
    match.userBet?.predictedAwayScore?.toString() ?? "",
  )
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
          predictedHomeScore: predictedHomeScore === "" ? undefined : Number(predictedHomeScore),
          predictedAwayScore: predictedAwayScore === "" ? undefined : Number(predictedAwayScore),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        setMessage(json.error ?? "Unable to save bet")
        return
      }
      const savedAction = json.action === "updated" || isEditing ? "updated" : "placed"
      setMessage(`Bet ${savedAction} on ${formatPickLabel(pick, match)}.`)
      await onPlaced()
    } catch {
      setMessage("Unable to save bet")
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
                    <span className="team-name">Draw</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="rounded-md border border-[var(--line)] bg-stone-50 px-3 py-2">
          <Text size="sm" fw={700}>
            Stake
          </Text>
          <Text fw={800}>{DEFAULT_BET_STAKE} points</Text>
        </div>
        <Text size="sm" c="dimmed">
          If your pick is correct, your stake is refunded. If not, it goes into the party fund.
        </Text>
        <Group grow align="flex-start">
          <TextInput
            label={formatScoreLabel("home", match)}
            type="number"
            min={0}
            value={predictedHomeScore}
            disabled={pending}
            onChange={(event) => setPredictedHomeScore(event.target.value)}
          />
          <TextInput
            label={formatScoreLabel("away", match)}
            type="number"
            min={0}
            value={predictedAwayScore}
            disabled={pending}
            onChange={(event) => setPredictedAwayScore(event.target.value)}
          />
        </Group>
        <Button type="submit" loading={pending}>
          {isEditing ? "Save changes" : "Place bet"}
        </Button>
        {message ? (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        ) : null}
      </Stack>
    </form>
  )
}
