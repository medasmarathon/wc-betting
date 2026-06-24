import type { DecodedIdToken } from "firebase-admin/auth"
import { FieldValue } from "firebase-admin/firestore"
import { ZodError } from "zod"
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import type { UserDoc, UserRole } from "@/types/betting"

export type AuthedUser = {
  uid: string
  email: string
  displayName: string
  role: UserRole
  isActive: boolean
  groupId?: string
  groupName?: string
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function emailKey(email: string) {
  return email.trim().toLowerCase()
}

export function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function requireUser(request: Request): Promise<AuthedUser> {
  const token = extractBearerToken(request)
  if (!token) throw new HttpError(401, "Missing authentication token")

  const decoded = await getAdminAuth().verifyIdToken(token)
  return ensureProfile(decoded)
}

export async function requireAdmin(request: Request): Promise<AuthedUser> {
  const user = await requireUser(request)
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin access required")
  return user
}

export async function ensureProfile(decoded: DecodedIdToken): Promise<AuthedUser> {
  const email = decoded.email?.toLowerCase()
  if (!email) throw new HttpError(403, "Firebase user must have an email")

  const db = getAdminDb()
  const userRef = db.collection("users").doc(decoded.uid)
  const existing = await userRef.get()

  if (existing.exists) {
    const user = existing.data() as UserDoc
    if (!user.isActive) throw new HttpError(403, "User is inactive")
    return {
      uid: decoded.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      groupId: user.groupId,
      groupName: user.groupName,
    }
  }

  const inviteRef = db.collection("invites").doc(emailKey(email))
  const invite = await inviteRef.get()
  if (!invite.exists) throw new HttpError(403, "This email has not been invited")

  const inviteData = invite.data() as { displayName?: string; role?: UserRole }
  const role = adminEmails().has(email) ? "ADMIN" : (inviteData.role ?? "USER")
  const displayName =
    inviteData.displayName || decoded.name || email.slice(0, email.indexOf("@")) || email

  const userDoc: Omit<UserDoc, "createdAt" | "updatedAt"> & {
    createdAt: FieldValue
    updatedAt: FieldValue
  } = {
    email,
    displayName,
    role,
    isActive: true,
    balance: 1000,
    startingBalance: 1000,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef)
    if (userSnap.exists) return

    tx.set(userRef, userDoc)
    tx.set(
      inviteRef,
      {
        acceptedBy: decoded.uid,
        acceptedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    tx.set(db.collection("walletTransactions").doc(`initial_${decoded.uid}`), {
      userId: decoded.uid,
      userDisplayName: displayName,
      type: "INITIAL_CREDIT",
      amount: 1000,
      balanceAfter: 1000,
      description: "Initial unit balance",
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection("leaderboard").doc(decoded.uid), {
      userId: decoded.uid,
      displayName,
      balance: 1000,
      totalBets: 0,
      wonBets: 0,
      lostBets: 0,
      pendingBets: 0,
      totalStaked: 0,
      totalPayout: 0,
      netProfit: 0,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection("auditLogs").doc(), {
      actorId: decoded.uid,
      actorEmail: email,
      action: "USER_PROFILE_CREATED",
      entityType: "USER",
      entityId: decoded.uid,
      after: { email, displayName, role },
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  return { uid: decoded.uid, email, displayName, role, isActive: true }
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const message = error instanceof Error ? error.message : "Unexpected error"
  return Response.json({ error: message }, { status: 500 })
}

function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return undefined
  return authorization.slice("Bearer ".length)
}
