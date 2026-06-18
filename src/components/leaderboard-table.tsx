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
    <div className="panel overflow-x-auto">
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
              <td>{index + 1}</td>
              <td className="font-bold">{row.displayName}</td>
              <td>{row.balance}</td>
              <td>{row.totalBets ?? 0}</td>
              <td>{row.wonBets ?? 0}</td>
              <td>{row.lostBets ?? 0}</td>
              <td>{row.pendingBets ?? 0}</td>
              <td>{row.netProfit ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
