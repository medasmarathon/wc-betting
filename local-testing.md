## Local Development and Testing Plan

The project must be fully testable locally before deploying to Vercel.

Use:

* Firebase Local Emulator Suite
* Firebase Auth emulator
* Firestore emulator
* Firestore Security Rules tests
* Local seed data
* Next.js local development server
* Optional Vercel CLI for production-like local execution

---

## 1. Local Development Goals

The local setup should allow a developer to:

1. Run the Next.js app locally.
2. Sign in with local test users.
3. Read and write local Firestore emulator data.
4. Place bets without touching production Firebase.
5. Test admin result entry and settlement.
6. Test Firestore Security Rules.
7. Reset or reseed test data quickly.
8. Run automated tests before deployment.

No local development command should write to production Firestore unless explicitly configured.

---

## 2. Local Environment Files

Create:

```text
.env.example
.env.local
.env.test
```

### `.env.example`

Commit this file.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
FIRESTORE_EMULATOR_HOST=
FIREBASE_AUTH_EMULATOR_HOST=

CRON_SECRET=
ADMIN_EMAILS=
```

### `.env.local`

Used for local development.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=worldcup-bets-local
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id

FIREBASE_PROJECT_ID=worldcup-bets-local
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

CRON_SECRET=local-cron-secret
ADMIN_EMAILS=admin@example.com
```

### `.env.test`

Used for automated tests.

```env
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_PROJECT_ID=worldcup-bets-test
ADMIN_EMAILS=admin@example.com
```

---

## 3. Firebase Emulator Setup

Initialize Firebase in the project:

```bash
firebase init
```

Select:

```text
Firestore
Emulators
```

Enable emulators:

```text
Authentication Emulator
Firestore Emulator
Hosting Emulator, optional
Functions Emulator, optional
```

Recommended ports:

```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

The emulator UI should be available at:

```text
http://127.0.0.1:4000
```

---

## 4. Local Firebase Client Configuration

In `src/lib/firebase/client.ts`, connect the browser Firebase SDK to emulators when local mode is enabled.

```ts
import { initializeApp, getApps } from "firebase/app"
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    })
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
  } catch {
    // Avoid duplicate emulator connection errors during hot reload.
  }
}
```

---

## 5. Local Firebase Admin Configuration

In `src/lib/firebase/admin.ts`, server-side code should use emulator hosts automatically when the emulator environment variables are present.

```ts
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const projectId = process.env.FIREBASE_PROJECT_ID

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
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

export const adminAuth = getAuth()
export const adminDb = getFirestore()
```

Important:

* In local emulator mode, do not require production service account credentials.
* In production, require valid Firebase Admin credentials.

---

## 6. Local Seed Data

Create a seed script:

```text
scripts/seed-local.ts
```

The seed script should create:

### Test users

```text
admin@example.com
alice@example.com
bob@example.com
charlie@example.com
```

### Invites

```text
admin@example.com -> ADMIN
alice@example.com -> USER
bob@example.com -> USER
charlie@example.com -> USER
```

### User profiles

Each user should start with:

```text
1000 points
```

### Sample matches

Create at least three local matches:

1. One future match open for betting.
2. One match that has already kicked off and should be locked.
3. One completed match ready for result entry and settlement.

Example:

```ts
const sampleMatches = [
  {
    homeTeam: "Brazil",
    awayTeam: "Scotland",
    groupName: "Group C",
    stage: "GROUP",
    kickoffAt: futureDate,
    status: "OPEN",
    odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
  },
  {
    homeTeam: "Mexico",
    awayTeam: "South Korea",
    groupName: "Group A",
    stage: "GROUP",
    kickoffAt: pastDate,
    status: "OPEN",
    odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
  },
  {
    homeTeam: "England",
    awayTeam: "Ghana",
    groupName: "Group L",
    stage: "GROUP",
    kickoffAt: pastDate,
    status: "COMPLETED",
    homeScore: 2,
    awayScore: 1,
    resultPick: "HOME",
    odds: { HOME: 2.0, DRAW: 3.0, AWAY: 2.0 },
  },
]
```

---

## 7. Emulator Data Import and Export

Use a local data folder:

```text
.firebase-emulator-data/
```

Add scripts:

```json
{
  "scripts": {
    "emulators": "firebase emulators:start --import=.firebase-emulator-data --export-on-exit=.firebase-emulator-data",
    "emulators:fresh": "firebase emulators:start",
    "seed": "tsx scripts/seed-local.ts",
    "dev": "next dev",
    "dev:emulated": "concurrently \"npm run emulators\" \"npm run dev\""
  }
}
```

Behavior:

* `npm run emulators` starts Firebase emulators with saved data.
* `npm run emulators:fresh` starts empty emulators.
* `npm run seed` inserts local test users, invites, matches, balances, and leaderboard docs.
* `npm run dev:emulated` runs the app and emulators together.

---

## 8. Local Manual Testing Checklist

Before deploying, manually test this full flow locally:

### Auth

* Admin can log in.
* Regular user can log in.
* Non-invited user is blocked.

### Match visibility

* User can see upcoming matches.
* User can see locked matches.
* User can see completed matches.

### Betting

* User can place a valid bet before kickoff.
* User balance decreases after bet placement.
* User cannot place duplicate bet on same match.
* User cannot bet more points than their balance.
* User cannot bet after kickoff.
* User cannot change odds or payout from the client.

### Admin

* Regular user cannot access admin pages.
* Admin can create match.
* Admin can edit odds before kickoff.
* Admin can enter result.
* Admin can settle match.
* Settlement updates bet statuses.
* Settlement updates user balances.
* Settlement updates leaderboard.

### Idempotency

* Running settlement twice does not duplicate payout.
* Voiding a match twice does not duplicate refund.

### Auditability

* Bet placement creates wallet transaction.
* Admin result entry creates audit log.
* Settlement creates audit log.
* Balance adjustment requires a reason.

---

## 9. Automated Tests

Use Vitest or Jest.

Recommended:

```bash
npm install -D vitest @firebase/rules-unit-testing
```

Test categories:

### Unit tests

Test pure functions:

```text
calculateResultPick()
calculatePayout()
canPlaceBet()
buildLeaderboardUpdate()
```

### Firestore transaction tests

Run against the Firestore emulator.

Test:

```text
placeBet()
settleMatch()
voidMatch()
adjustBalance()
```

### Security Rules tests

Use Firebase Rules Unit Testing.

Test:

```text
User can read own profile.
User cannot update own balance directly.
User can read matches.
User cannot create wallet transaction directly.
User can read own bets.
User cannot read another user's private bet if restricted.
Regular user cannot write match result.
Regular user cannot write audit log.
Admin can read audit logs.
```

### API route tests

Test route handlers with mocked auth or emulator auth tokens.

Test:

```text
POST /api/bets
POST /api/admin/matches/:id/result
POST /api/admin/matches/:id/settle
GET /api/leaderboard
```

---

## 10. Recommended Test Scripts

Add:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:rules": "firebase emulators:exec --only firestore \"vitest run tests/rules\"",
    "test:integration": "firebase emulators:exec --only auth,firestore \"vitest run tests/integration\"",
    "check": "npm run lint && npm run typecheck && npm run test"
  }
}
```

Required CI command before deployment:

```bash
npm run check
```

---

## 11. Vercel Local Development

Use normal Next.js local development most of the time:

```bash
npm run dev
```

For Vercel-like local execution, use:

```bash
npm install -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

Use this when testing:

* Vercel environment variables
* API route behavior
* Production-like serverless behavior
* Cron endpoint behavior

Do not use production Firebase credentials while testing normal local development.

---

## 12. CI / Preview Deployment Plan

Use GitHub + Vercel Preview Deployments.

For every pull request:

1. Run lint.
2. Run typecheck.
3. Run unit tests.
4. Run Firestore emulator integration tests.
5. Run Security Rules tests.
6. Deploy Vercel preview only if checks pass.

Suggested GitHub Actions flow:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run lint

      - run: npm run typecheck

      - run: npm run test

      - run: npm run test:rules

      - run: npm run test:integration
```

---

## 13. Production Safety Checklist

Before deploying production:

```text
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
FIRESTORE_EMULATOR_HOST is not set
FIREBASE_AUTH_EMULATOR_HOST is not set
FIREBASE_PRIVATE_KEY is set only in Vercel server environment
ADMIN_EMAILS is correct
Firestore Security Rules are deployed
Firestore indexes are deployed
Production invites are created
Production admin user is created
```

Never deploy with emulator environment variables enabled.

---

## 14. Acceptance Criteria for Local Testing

Local development is complete when:

1. A developer can clone the repo and run the app locally.
2. Firebase emulators run without requiring production credentials.
3. Seed data creates test users, matches, balances, and invites.
4. A regular user can place a bet locally.
5. Admin can enter result and settle locally.
6. Leaderboard updates locally.
7. Security Rules tests pass.
8. Integration tests pass.
9. Local data can be reset or re-imported easily.
10. Production Firebase is never touched during local testing.
