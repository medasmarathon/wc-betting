"use client"

import { useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
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

  useEffect(() => {
    apiFetch("/api/admin/audit-log")
      .then((response) => response.json())
      .then((json) => setLogs(json.logs ?? []))
  }, [apiFetch])

  return (
    <main className="page grid gap-5">
      <h1 className="text-3xl font-black">Audit log</h1>
      <div className="panel overflow-x-auto">
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
                <td>{log.createdAt ? formatKickoff(log.createdAt) : ""}</td>
                <td>{log.actorEmail ?? "system"}</td>
                <td className="font-bold">{log.action}</td>
                <td>{log.entityType}</td>
                <td>{log.entityId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
