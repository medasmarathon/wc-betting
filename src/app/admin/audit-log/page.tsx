"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { TableSkeleton } from "@/components/loading-state"
import { formatKickoff } from "@/lib/time"

type AuditLog = {
  id: string
  actorEmail?: string
  action: string
  entityType: string
  entityId?: string
  createdAt?: string
}

export default function AdminAuditLogPage() {
  return (
    <AuthGate adminOnly>
      <AdminAuditLogContent />
    </AuthGate>
  )
}

function AdminAuditLogContent() {
  const { apiFetch } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  useEffect(() => {
    apiFetch("/api/admin/audit-log")
      .then((response) => response.json())
      .then((json) => setLogs(json.logs ?? []))
      .finally(() => setLoadingLogs(false))
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <h1 className="page-title text-3xl font-black">Audit log</h1>
      {loadingLogs ? (
        <TableSkeleton label="Loading audit log..." rows={5} columns={5} />
      ) : (
        <div className="panel table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td data-label="Time">{log.createdAt ? formatKickoff(log.createdAt) : ""}</td>
                <td data-label="Actor">{log.actorEmail ?? "system"}</td>
                <td data-label="Action" className="page-title font-bold">{log.action}</td>
                <td data-label="Entity">{log.entityType}</td>
                <td data-label="ID">{log.entityId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </main>
  )
}
