"use client"

import { useI18n } from "@/components/language-provider"
import { unitLabel } from "@/lib/i18n"

type Row = {
  id: string
  displayName: string
  balance: number
  totalBets?: number
  wonBets?: number
  lostBets?: number
  pendingBets?: number
  netProfit?: number
}

export function LeaderboardTable({ rows }: { rows: Row[] }) {
  const { locale, t } = useI18n()

  return (
    <div className="panel table-shell">
      <table className="table">
        <thead>
          <tr>
            <th>{t.table.rank}</th>
            <th>{t.table.name}</th>
            <th>{t.table.balance}</th>
            <th>{t.table.bets}</th>
            <th>{t.table.wins}</th>
            <th>{t.table.losses}</th>
            <th>{t.table.pending}</th>
            <th>{t.table.net}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td data-label={t.table.rank}>{index + 1}</td>
              <td data-label={t.table.name} className="page-title font-bold">{row.displayName}</td>
              <td data-label={t.table.balance}>{unitLabel(row.balance, locale)}</td>
              <td data-label={t.table.bets}>{row.totalBets ?? 0}</td>
              <td data-label={t.table.wins}>{row.wonBets ?? 0}</td>
              <td data-label={t.table.losses}>{row.lostBets ?? 0}</td>
              <td data-label={t.table.pending}>{row.pendingBets ?? 0}</td>
              <td data-label={t.table.net}>{unitLabel(row.netProfit ?? 0, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
