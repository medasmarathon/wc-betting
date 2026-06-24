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
  return (
    <div className="panel table-shell">
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Balance</th>
            <th>Bets</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Pending</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td data-label="Rank">{index + 1}</td>
              <td data-label="Name" className="page-title font-bold">{row.displayName}</td>
              <td data-label="Balance">{row.balance}</td>
              <td data-label="Bets">{row.totalBets ?? 0}</td>
              <td data-label="Wins">{row.wonBets ?? 0}</td>
              <td data-label="Losses">{row.lostBets ?? 0}</td>
              <td data-label="Pending">{row.pendingBets ?? 0}</td>
              <td data-label="Net">{row.netProfit ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
