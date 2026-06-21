# World Cup Bets

Private, invite-only, points-only betting app for a small friends group. The app uses Next.js App Router, Firebase Auth, Cloud Firestore, Firebase Admin SDK, Firestore rules, and Vercel hosting.

No real-money deposits, withdrawals, payments, or public wagering are supported.

## Prerequisites

- Node.js 20 or newer
- npm
- Firebase CLI access
- A Firebase project for production
- A Vercel project for live hosting

Install dependencies:

```bash
npm install
```

## Local Setup

Local development should use Firebase emulators so production Firestore is not touched.

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Use local emulator values in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=worldcup-bets-local
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id

FIREBASE_PROJECT_ID=worldcup-bets-local

NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

CRON_SECRET=local-cron-secret
ADMIN_EMAILS=admin@example.com
SCHEDULE_SYNC_SOURCE=espn
SCHEDULE_SYNC_FALLBACK=thestatsapi
```

3. Start Firebase emulators in one terminal:

```bash
npm run emulators
```

Emulator UI:

```text
http://127.0.0.1:4000
```

4. Seed local users and sample matches in another terminal:

```bash
npm run seed
```

Seeded local users:

```text
admin@example.com
alice@example.com
bob@example.com
charlie@example.com
```

Local password:

```text
password123
```

5. Start the Next.js dev server:

```bash
npm run dev
```

Default app URL:

```text
http://localhost:3000
```

You can also run app and emulators together:

```bash
npm run dev:emulated
```

## Local Testing

Fast checks that do not require running the emulator suite:

```bash
npm run check
```

This runs:

```bash
npm run lint
npm run typecheck
npm run test
```

Emulator-backed checks:

```bash
npm run test:rules
npm run test:integration
```

Before deploying, manually verify the local flow:

1. Admin can log in.
2. Regular user can log in.
3. Non-invited user is blocked.
4. Admin can create a match.
5. User can place one valid pre-kickoff bet.
6. Duplicate, over-balance, and after-kickoff bets are blocked.
7. Admin can enter a result and settle the match.
8. User balance, bet history, wallet transactions, audit logs, and leaderboard update.
9. Running settlement twice does not duplicate payout.

## Production Firebase Setup

Create one Firebase project and enable:

- Authentication
- Cloud Firestore

Recommended auth providers:

- Email/password
- Google sign-in

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Create production invite documents in Firestore under `invites/{lowercaseEmail}`:

```ts
{
  email: "friend@example.com",
  displayName: "Friend",
  role: "USER",
  createdAt: serverTimestamp()
}
```

At least one invite should have:

```ts
role: "ADMIN"
```

Also include that admin email in `ADMIN_EMAILS`.

## Vercel Live Setup

Create a Vercel project connected to this repository.

Set these production environment variables in Vercel:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false

CRON_SECRET=
ADMIN_EMAILS=
SCHEDULE_SYNC_SOURCE=espn
SCHEDULE_SYNC_FALLBACK=thestatsapi
```

Do not set these in production:

```env
FIRESTORE_EMULATOR_HOST
FIREBASE_AUTH_EMULATOR_HOST
```

Important:

- `NEXT_PUBLIC_*` values are safe for browser code.
- `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` must only be set in Vercel server environment variables.
- Store `FIREBASE_PRIVATE_KEY` with escaped newlines if needed, using `\n`.
- `ADMIN_EMAILS` is a comma-separated list, for example `admin@example.com,second-admin@example.com`.
- `CRON_SECRET` protects the schedule, locking, and settlement maintenance endpoint.
- `SCHEDULE_SYNC_SOURCE` defaults to `espn`.
- `SCHEDULE_SYNC_FALLBACK` defaults to `thestatsapi`.

## World Cup Schedule Sync

The app can import the WC 2026 schedule from free JSON sources using:

```text
GET /api/cron/sync-schedule
```

The endpoint accepts Vercel Cron's `Authorization: Bearer ${CRON_SECRET}` header and the local/manual `x-cron-secret` header. `vercel.json` runs it every 6 hours.

Sync behavior:

- ESPN scoreboard JSON is the primary source.
- TheStatsAPI's free fixtures JSON is the fallback source and requires attribution: data fallback provided by TheStatsAPI, https://www.thestatsapi.com.
- Imported matches use stable IDs like `wc2026-match-1`.
- Placeholder knockout matches are stored but are not bettable until both teams are confirmed.
- Completed matches with an unambiguous final result are settled automatically.
- Settlement uses the official final outcome, including extra time or penalties when applicable. `DRAW` only wins when the official final result is a draw.

## Production Verification

Before going live:

```bash
npm run check
npm run build
```

Then deploy through Vercel.

After deployment:

1. Confirm emulator variables are not present in production.
2. Confirm Firestore rules and indexes are deployed.
3. Confirm production invites exist.
4. Sign in as an invited admin.
5. Create a test match.
6. Sign in as an invited regular user.
7. Place a small points bet.
8. Enter result as admin and settle.
9. Confirm leaderboard and bet history update.

## Useful Scripts

```bash
npm run dev              # Start Next.js locally
npm run build            # Build production app
npm run start            # Start built app
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checks
npm run test             # Run unit tests
npm run check            # Run lint, typecheck, and unit tests
npm run emulators        # Start Firebase emulators with import/export
npm run emulators:fresh  # Start empty Firebase emulators
npm run seed             # Seed local emulator users and matches
npm run test:rules       # Run Firestore rules tests through emulator
npm run test:integration # Run integration tests through emulators
```

## Safety Notes

- All sensitive writes go through server-side API routes using Firebase Admin SDK.
- Users must not directly write bets, balances, wallet transactions, match results, settlement status, or audit logs.
- Bet placement and settlement run in Firestore transactions.
- Bets use deterministic IDs: `{matchId}_{userId}`.
- Odds are copied onto each bet at placement time.
- Settlement is idempotent and only processes pending bets.
