"use client"

import { Button } from "@mantine/core"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AuthGate, useAuth } from "@/components/auth-provider"
import { CardListSkeleton, LoadingPanel } from "@/components/loading-state"

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
  fundTotal: number
  balance: number
  netProfit: number
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalPayout: number
  members: GroupMemberPerformance[]
}

type GroupMemberPerformance = {
  id: string
  email: string
  displayName: string
  isActive: boolean
  balance: number
  netProfit: number
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalPayout: number
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
  const [loadingUsers, setLoadingUsers] = useState(true)

  const load = useCallback(async () => {
    try {
      const [usersResponse, groupsResponse] = await Promise.all([apiFetch("/api/admin/users"), apiFetch("/api/admin/groups")])
      const [usersJson, groupsJson] = await Promise.all([usersResponse.json(), groupsResponse.json()])
      setUsers(usersJson.users ?? [])
      setGroups(groupsJson.groups ?? [])
    } finally {
      setLoadingUsers(false)
    }
  }, [apiFetch])

  useEffect(() => {
    void load()
  }, [load])

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

  async function setPointsLeft(user: User, pointsLeft: string, reason: string) {
    const normalizedPointsLeft = pointsLeft.trim()
    const normalizedReason = reason.trim()
    const balanceAfter = Number(normalizedPointsLeft)

    if (!normalizedPointsLeft || !Number.isInteger(balanceAfter) || balanceAfter < 0) {
      setMessage("Points left must be a whole non-negative number.")
      return false
    }

    if (normalizedReason.length < 3) {
      setMessage("Reason must be at least 3 characters.")
      return false
    }

    if (balanceAfter === user.balance) {
      setMessage("Points left is unchanged.")
      return false
    }

    const response = await apiFetch(`/api/admin/users/${user.id}/adjust-balance`, {
      method: "POST",
      body: JSON.stringify({ balanceAfter, reason: normalizedReason }),
    })
    const json = await response.json()
    setMessage(response.ok ? `Points left updated to ${balanceAfter} pts.` : json.error ?? "Unable to update points left")
    if (response.ok) load()
    return response.ok
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

  async function renameGroup(group: Group, name: string) {
    const normalizedName = name.trim()

    if (!normalizedName) {
      setMessage("Group name is required.")
      return false
    }

    if (normalizedName === group.name) {
      setMessage("Group name is unchanged.")
      return false
    }

    const response = await apiFetch(`/api/admin/groups/${group.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: normalizedName }),
    })
    const json = await response.json()
    setMessage(response.ok ? "Group updated." : json.error ?? "Unable to update group")
    if (response.ok) load()
    return response.ok
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
        {loadingUsers ? (
          <LoadingPanel label="Loading groups..." />
        ) : groups.length ? (
          <div className="grid gap-3">
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} renameGroup={renameGroup} />
            ))}
          </div>
        ) : (
          <p className="page-subtitle text-sm">No groups yet.</p>
        )}
      </section>
      {loadingUsers ? (
        <CardListSkeleton label="Loading users..." count={3} />
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <UserRow
              key={`${user.id}:${user.balance}`}
              user={user}
              groups={groups}
              toggle={() => toggle(user)}
              setPointsLeft={setPointsLeft}
              assignGroup={assignGroup}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function GroupRow({
  group,
  renameGroup,
}: {
  group: Group
  renameGroup: (group: Group, name: string) => Promise<boolean>
}) {
  const [name, setName] = useState(group.name)
  const [pending, setPending] = useState(false)
  const winRate = group.wonBets + group.lostBets > 0 ? Math.round((group.wonBets / (group.wonBets + group.lostBets)) * 100) : null

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    try {
      await renameGroup(group, name)
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="grid gap-3 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_2fr]">
        <form className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_auto]" onSubmit={submitRename}>
          <input
            aria-label={`Name for ${group.name}`}
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Button type="submit" loading={pending}>
            Rename
          </Button>
        </form>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Group fund" value={`${group.fundTotal} pts`} />
          <Metric label="Members" value={String(group.memberCount)} />
          <Metric label="Net" value={`${formatSigned(group.netProfit)} pts`} />
          <Metric label="Win rate" value={winRate === null ? "No settled bets" : `${winRate}%`} />
        </div>
      </div>
      {group.members.length ? (
        <div className="grid gap-2">
          {group.members.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 rounded-md border border-[var(--border)] p-3 text-sm lg:grid-cols-[minmax(180px,1fr)_repeat(5,minmax(88px,auto))]"
            >
              <div>
                <div className="font-bold">{member.displayName}</div>
                <div className="page-subtitle text-xs">
                  {member.email} • {member.isActive ? "active" : "inactive"}
                </div>
              </div>
              <Metric label="Balance" value={`${member.balance} pts`} compact />
              <Metric label="Net" value={`${formatSigned(member.netProfit)} pts`} compact />
              <Metric label="Bets" value={String(member.totalBets)} compact />
              <Metric label="Won/Lost" value={`${member.wonBets}/${member.lostBets}`} compact />
              <Metric label="Pending" value={String(member.pendingBets)} compact />
            </div>
          ))}
        </div>
      ) : (
        <p className="page-subtitle text-sm">No members yet.</p>
      )}
    </article>
  )
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <div className="page-subtitle text-xs font-bold uppercase">{label}</div>
      <div className={`page-title font-black ${compact ? "text-base" : "text-xl"}`}>{value}</div>
    </div>
  )
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${value}`
}

function UserRow({
  user,
  groups,
  toggle,
  setPointsLeft,
  assignGroup,
}: {
  user: User
  groups: Group[]
  toggle: () => void
  setPointsLeft: (user: User, pointsLeft: string, reason: string) => Promise<boolean>
  assignGroup: (user: User, groupId: string) => Promise<void>
}) {
  const [pointsLeft, setPointsLeftInput] = useState(String(user.balance))
  const [reason, setReason] = useState("")
  const targetBalance = pointsLeft.trim() === "" ? Number.NaN : Number(pointsLeft)
  const hasValidTargetBalance = Number.isInteger(targetBalance) && targetBalance >= 0
  const delta = hasValidTargetBalance ? targetBalance - user.balance : null
  const deltaLabel = delta === null ? "Invalid" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} pts`
  const deltaStatusClass = delta === null || delta < 0 ? "status-danger" : delta > 0 ? "status-bettable" : "status-neutral"

  async function submitPointsLeft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const updated = await setPointsLeft(user, pointsLeft, reason)
    if (updated) setReason("")
  }

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
      <form className="grid gap-2 md:grid-cols-[minmax(140px,180px)_1fr_auto_auto_auto]" onSubmit={submitPointsLeft}>
        <input
          aria-label={`Points left for ${user.displayName}`}
          className="field"
          type="number"
          min={0}
          step={1}
          placeholder="Points left"
          value={pointsLeft}
          onChange={(event) => setPointsLeftInput(event.target.value)}
          required
        />
        <input
          aria-label={`Reason for changing points left for ${user.displayName}`}
          className="field"
          placeholder="Required reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          required
        />
        <span className={`status-badge ${deltaStatusClass} self-center justify-self-start whitespace-nowrap`}>
          {deltaLabel}
        </span>
        <button className="button" type="submit">
          Set points
        </button>
        <button className="button secondary" type="button" onClick={toggle}>
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </form>
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
