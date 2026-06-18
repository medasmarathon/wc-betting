"use client"

import { useCallback, useEffect, useState } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"

type User = {
  id: string
  email: string
  displayName: string
  role: string
  balance: number
  isActive: boolean
}

export default function AdminUsersPage() {
  return (
    <AuthGate adminOnly>
      <AdminUsersContent />
    </AuthGate>
  )
}

function AdminUsersContent() {
  const { apiFetch } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch("/api/admin/users")
      .then((response) => response.json())
      .then((json) => setUsers(json.users ?? []))
  }, [apiFetch])

  useEffect(() => load(), [load])

  async function toggle(user: User) {
    const response = await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    const json = await response.json()
    setMessage(response.ok ? "User updated." : json.error ?? "Unable to update user")
    load()
  }

  async function adjust(userId: string, amount: string, reason: string) {
    const response = await apiFetch(`/api/admin/users/${userId}/adjust-balance`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(amount), reason }),
    })
    const json = await response.json()
    setMessage(response.ok ? "Balance adjusted." : json.error ?? "Unable to adjust balance")
    load()
  }

  return (
    <main className="page grid gap-5">
      <h1 className="text-3xl font-black">Manage users</h1>
      {message ? <div className="panel p-3 text-sm">{message}</div> : null}
      <div className="grid gap-4">
        {users.map((user) => (
          <UserRow key={user.id} user={user} toggle={() => toggle(user)} adjust={adjust} />
        ))}
      </div>
    </main>
  )
}

function UserRow({
  user,
  toggle,
  adjust,
}: {
  user: User
  toggle: () => void
  adjust: (userId: string, amount: string, reason: string) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")

  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{user.displayName}</h2>
          <p className="text-sm text-stone-600">
            {user.email} • {user.role} • {user.isActive ? "active" : "inactive"}
          </p>
        </div>
        <div className="text-2xl font-black">{user.balance} pts</div>
      </div>
      <div className="grid gap-2 md:grid-cols-[120px_1fr_auto_auto]">
        <input className="field" type="number" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input className="field" placeholder="Required reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <button className="button" onClick={() => adjust(user.id, amount, reason)}>
          Adjust
        </button>
        <button className="button secondary" onClick={toggle}>
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </article>
  )
}
