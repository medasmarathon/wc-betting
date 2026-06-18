import "dotenv/config"
import { config } from "dotenv"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore"

config({ path: ".env.local", override: false })

const projectId = process.env.FIREBASE_PROJECT_ID ?? "worldcup-bets-local"

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    initializeApp({ projectId })
  } else {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    })
  }
}

const auth = getAuth()
const db = getFirestore()
const password = "password123"

const users = [
  { email: "admin@example.com", displayName: "Admin", role: "ADMIN" as const },
  { email: "alice@example.com", displayName: "Alice", role: "USER" as const },
  { email: "bob@example.com", displayName: "Bob", role: "USER" as const },
  { email: "charlie@example.com", displayName: "Charlie", role: "USER" as const },
]

async function upsertAuthUser(email: string, displayName: string) {
  try {
    const existing = await auth.getUserByEmail(email)
    await auth.updateUser(existing.uid, { displayName, password })
    return existing.uid
  } catch {
    const created = await auth.createUser({ email, displayName, password, emailVerified: true })
    return created.uid
  }
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Refusing to seed without FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST")
  }

  for (const user of users) {
    const uid = await upsertAuthUser(user.email, user.displayName)
    await db.collection("invites").doc(user.email).set({
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      acceptedBy: uid,
      acceptedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    })
    await db.collection("users").doc(uid).set({
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: true,
      balance: 1000,
      startingBalance: 1000,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    await db.collection("leaderboard").doc(uid).set({
      userId: uid,
      displayName: user.displayName,
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
    await db.collection("walletTransactions").doc(`initial_${uid}`).set({
      userId: uid,
      userDisplayName: user.displayName,
      type: "INITIAL_CREDIT",
      amount: 1000,
      balanceAfter: 1000,
      description: "Initial local points balance",
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  const now = Date.now()
  const sampleMatches = [
    {
      id: "sample_brazil_scotland",
      homeTeam: "Brazil",
      awayTeam: "Scotland",
      groupName: "Group C",
      stage: "GROUP",
      kickoffAt: Timestamp.fromMillis(now + 1000 * 60 * 60 * 24),
      status: "OPEN",
      odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
    },
    {
      id: "sample_mexico_south_korea",
      homeTeam: "Mexico",
      awayTeam: "South Korea",
      groupName: "Group A",
      stage: "GROUP",
      kickoffAt: Timestamp.fromMillis(now - 1000 * 60 * 60),
      status: "OPEN",
      odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
    },
    {
      id: "sample_england_ghana",
      homeTeam: "England",
      awayTeam: "Ghana",
      groupName: "Group L",
      stage: "GROUP",
      kickoffAt: Timestamp.fromMillis(now - 1000 * 60 * 60 * 3),
      status: "COMPLETED",
      homeScore: 2,
      awayScore: 1,
      resultPick: "HOME",
      odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
    },
  ]

  for (const match of sampleMatches) {
    const { id, ...data } = match
    await db.collection("matches").doc(id).set({
      ...data,
      betCount: 0,
      totalStaked: 0,
      createdBy: "seed",
      updatedBy: "seed",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  await db.collection("auditLogs").add({
    action: "LOCAL_SEED_COMPLETED",
    entityType: "SYSTEM",
    after: { users: users.length, matches: sampleMatches.length },
    createdAt: FieldValue.serverTimestamp(),
  })

  console.log(`Seeded ${users.length} users and ${sampleMatches.length} matches.`)
  console.log(`Local password for seeded users: ${password}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
