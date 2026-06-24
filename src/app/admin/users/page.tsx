"use client"

import { Button } from "@mantine/core"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"

type InviteRole = "USER" | "ADMIN"

type User = {
  id: string
  email: string
  displayName: string
  role: string
  balance: number
  isActive: boolean
  groupId?: string
  groupName?: string
}

type Group = {
  id: string
  name: string
  memberCount: number
}

type InviteFormState = {
  email: string
  displayName: string
  role: InviteRole
}

const emptyInviteForm: InviteFormState = {
  email: "",
  displayName: "",
  role: "USER",
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
  const [groups, setGroups] = useState<Group[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState<InviteFormState>(emptyInviteForm)
  const [invitePending, setInvitePending] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupPending, setGroupPending] = useState(false)

  const load = useCallback(() => {
    Promise.all([apiFetch("/api/admin/users"), apiFetch("/api/admin/groups")])
      .then(async ([usersResponse, groupsResponse]) => {
        const [usersJson, groupsJson] = await Promise.all([usersResponse.json(), groupsResponse.json()])
        setUsers(usersJson.users ?? [])
        setGroups(groupsJson.groups ?? [])
      })
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

  async function assignGroup(user: User, groupId: string) {
    const response = await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ groupId: groupId || null }),
    })
    const json = await response.json()
    setMessage(response.ok ? "Group updated." : json.error ?? "Unable to update group")
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

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInvitePending(true)

    try {
      const response = await apiFetch("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify(inviteForm),
      })
      const json = await response.json()
      setMessage(response.ok ? "Invite saved." : json.error ?? "Unable to save invite")
      if (response.ok) setInviteForm(emptyInviteForm)
    } finally {
      setInvitePending(false)
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGroupPending(true)

    try {
      const response = await apiFetch("/api/admin/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName }),
      })
      const json = await response.json()
      setMessage(response.ok ? "Group created." : json.error ?? "Unable to create group")
      if (response.ok) {
        setGroupName("")
        load()
      }
    } finally {
      setGroupPending(false)
    }
  }

  return (
    <main className="page grid gap-5">
      <h1 className="page-title text-3xl font-black">Manage users</h1>
      {message ? <div className="panel p-3 text-sm">{message}</div> : null}
      <section className="panel grid gap-3 p-4">
        <h2 className="page-title text-xl font-black">Invite user</h2>
        <form className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_auto]" onSubmit={invite}>
          <input
            aria-label="Invite email"
            className="field"
            type="email"
            placeholder="Email"
            value={inviteForm.email}
            onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
          <input
            aria-label="Invite display name"
            className="field"
            placeholder="Display name"
            value={inviteForm.displayName}
            onChange={(event) => setInviteForm((current) => ({ ...current, displayName: event.target.value }))}
          />
          <select
            aria-label="Invite role"
            className="field"
            value={inviteForm.role}
            onChange={(event) =>
              setInviteForm((current) => ({ ...current, role: event.target.value as InviteRole }))
            }
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button type="submit" loading={invitePending}>
            Add invite
          </Button>
        </form>
      </section>
      <section className="panel grid gap-3 p-4">
        <h2 className="page-title text-xl font-black">User groups</h2>
        <form className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_auto]" onSubmit={createGroup}>
          <input
            aria-label="Group name"
            className="field"
            placeholder="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            required
          />
          <Button type="submit" loading={groupPending}>
            Create group
          </Button>
        </form>
        {groups.length ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <span key={group.id} className="status-badge status-bettable">
                {group.name} · {group.memberCount}
              </span>
            ))}
          </div>
        ) : (
          <p className="page-subtitle text-sm">No groups yet.</p>
        )}
      </section>
      <div className="grid gap-4">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            groups={groups}
            toggle={() => toggle(user)}
            adjust={adjust}
            assignGroup={assignGroup}
          />
        ))}
      </div>
    </main>
  )
}

function UserRow({
  user,
  groups,
  toggle,
  adjust,
  assignGroup,
}: {
  user: User
  groups: Group[]
  toggle: () => void
  adjust: (userId: string, amount: string, reason: string) => Promise<void>
  assignGroup: (user: User, groupId: string) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")

  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="page-title text-xl font-black">{user.displayName}</h2>
          <p className="page-subtitle text-sm">
            {user.email} • {user.role} • {user.isActive ? "active" : "inactive"}
          </p>
          <p className="page-subtitle text-sm">{user.groupName ? `Group: ${user.groupName}` : "No group"}</p>
        </div>
        <div className="page-title text-2xl font-black">{user.balance} pts</div>
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
      <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_auto]">
        <select
          aria-label={`Group for ${user.displayName}`}
          className="field"
          value={user.groupId ?? ""}
          onChange={(event) => assignGroup(user, event.target.value)}
        >
          <option value="">No group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <span className="page-subtitle self-center text-sm">Lost bets fund the selected group.</span>
      </div>
    </article>
  )
}
