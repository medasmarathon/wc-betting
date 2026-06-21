# Updated Implementation Specification: Private World Cup Friends Betting App with Firestore

## 1. Project Summary

Build a private, invite-only web app for a small group of friends to place fun, points-only bets on upcoming World Cup matches.

The app is for fewer than 10 users. It must not process real-money deposits, withdrawals, payments, or public wagering.

Users should be able to:

1. Sign in.
2. View upcoming World Cup matches.
3. Place one bet per match before kickoff.
4. Have bets automatically locked when the match starts.
5. See their bet history.
6. See the group leaderboard.
7. Let an admin enter results and settle bets.

The app should prioritize simplicity, correctness, and auditability.

---

## 2. Final Recommended Stack

Use:

* Next.js with App Router
* TypeScript
* Tailwind CSS
* Firebase Auth
* Cloud Firestore
* Firebase Admin SDK
* Firestore Security Rules
* Vercel hosting
* GitHub for deployment

Suggested packages:

```bash
npm install firebase firebase-admin zod date-fns
```

Optional UI:

```bash
npx shadcn@latest init
```

---

## 3. Hosting Plan

### Frontend and Server

Host the Next.js app on Vercel.

Use Vercel for:

* Static pages
* Server-rendered pages
* API routes
* Server actions
* Optional cron endpoint

### Backend Services

Use Firebase for:

* Authentication
* Firestore database
* Security rules
* Optional local emulator development

### Environment Variables

Use these Vercel environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

CRON_SECRET=
ADMIN_EMAILS=
```

Rules:

* `NEXT_PUBLIC_*` variables can be used in browser code.
* Firebase Admin credentials must only be used server-side.
* Never expose `FIREBASE_PRIVATE_KEY` to client code.
* `ADMIN_EMAILS` is a comma-separated list of admin emails.
* `CRON_SECRET` protects cron/admin maintenance endpoints.

---

## 4. Firebase Setup

Create one Firebase project.

Enable:

* Firebase Authentication
* Cloud Firestore

For authentication, use one of:

1. Email/password
2. Google sign-in
3. Email link sign-in

For the MVP, email/password or Google sign-in is simplest.

Use an `invites` collection to restrict who can access the app.

---

## 5. Scope

### In Scope

The MVP should support:

* Invite-only users
* Firebase Auth login
* Admin and regular user roles
* World Cup match list
* Betting on match result:

  * HOME
  * DRAW
  * AWAY
* Optional score prediction
* Point-based wallet
* Automatic locking at kickoff
* Admin result entry
* Automatic settlement
* Leaderboard
* Bet history
* Audit log

### Out of Scope

Do not implement:

* Real-money payments
* Deposits
* Withdrawals
* Public user registration
* Public betting
* Live betting
* Parlays
* Cash-out
* Complex odds markets
* External sportsbook integration
* Automated sports-data API integration unless requested later

---

## 6. Core Betting Rules

### Starting Balance

Each invited user starts with:

```text
1000 points
```

These points have no monetary value.

### Bet Type

For MVP, each user may place one bet per match.

Market:

```text
Official final match result:
- HOME
- DRAW
- AWAY
```

For knockout games, settle by the official final result, including extra time or penalties when applicable. `DRAW` only wins when the official final result is a draw.

### Bet Locking

A bet is allowed only when:

```text
serverNow < match.kickoffAt
match.status is SCHEDULED or OPEN
user has enough balance
user has not already placed a bet on this match
```

After kickoff:

```text
No new bets.
No edits.
No cancellations.
```

Always enforce locking on the server. Client-side countdowns are only for user experience.

### Odds

Use fixed odds per match.

Default:

```text
HOME: 2.0
DRAW: 3.0
AWAY: 2.0
```

When a user places a bet, copy the odds into the bet document. Existing bets must not change if admin later edits match odds.

### Settlement

When admin enters the final score:

```text
homeScore > awayScore => HOME wins
homeScore = awayScore => DRAW wins
homeScore < awayScore => AWAY wins
```

Settlement logic:

1. Read match.
2. Confirm result exists.
3. Confirm match has not already been settled.
4. Read all pending bets for the match.
5. For winning bets:

   * Set status to WON.
   * Set payout to stake * odds.
   * Add payout transaction.
   * Increase user balance.
6. For losing bets:

   * Set status to LOST.
   * Payout is 0.
7. Set match status to SETTLED.
8. Write audit log.

Settlement must be idempotent. Running it twice must not duplicate payouts.

---

## 7. Firestore Data Model

Use denormalized documents. Do not try to model Firestore like SQL.

Recommended collections:

```text
users
invites
matches
bets
walletTransactions
leaderboard
auditLogs
```

---

## 8. Collection Schemas

### `users/{userId}`

```ts
type UserDoc = {
  email: string
  displayName: string
  role: "USER" | "ADMIN"
  isActive: boolean
  balance: number
  startingBalance: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:

* Store current balance directly for simple reads.
* Also write wallet transactions for auditability.
* Balance updates must happen only in server-side transactions.

---

### `invites/{emailKey}`

Use lowercase email as document ID, with unsafe characters normalized if needed.

```ts
type InviteDoc = {
  email: string
  displayName?: string
  role: "USER" | "ADMIN"
  acceptedBy?: string
  acceptedAt?: Timestamp
  createdAt: Timestamp
}
```

Usage:

* When user signs in, check whether their email exists in `invites`.
* If not invited, block access.
* If invited and no user profile exists, create `users/{uid}`.

---

### `matches/{matchId}`

```ts
type MatchDoc = {
  externalId?: string

  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string

  groupName?: string
  stage: "GROUP" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL"

  kickoffAt: Timestamp
  status: "SCHEDULED" | "OPEN" | "LOCKED" | "LIVE" | "COMPLETED" | "SETTLED" | "VOIDED"

  odds: {
    HOME: number
    DRAW: number
    AWAY: number
  }

  homeScore?: number
  awayScore?: number
  resultPick?: "HOME" | "DRAW" | "AWAY"

  betCount: number
  totalStaked: number

  lockedAt?: Timestamp
  completedAt?: Timestamp
  settledAt?: Timestamp

  createdBy?: string
  updatedBy?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `bets/{betId}`

Use deterministic bet ID to prevent duplicate bets:

```text
{matchId}_{userId}
```

Example:

```text
match_abc_user_xyz
```

Schema:

```ts
type BetDoc = {
  userId: string
  userEmail: string
  userDisplayName: string

  matchId: string
  matchLabel: string
  homeTeam: string
  awayTeam: string
  kickoffAt: Timestamp

  pick: "HOME" | "DRAW" | "AWAY"
  stake: number
  odds: number
  potentialPayout: number

  predictedHomeScore?: number
  predictedAwayScore?: number

  status: "PENDING" | "WON" | "LOST" | "VOIDED"
  payout: number

  placedAt: Timestamp
  settledAt?: Timestamp
}
```

Denormalized match/user fields are intentional. They make bet history easy to display without joins.

---

### `walletTransactions/{transactionId}`

```ts
type WalletTransactionDoc = {
  userId: string
  userDisplayName: string

  type:
    | "INITIAL_CREDIT"
    | "BET_STAKE"
    | "BET_PAYOUT"
    | "ADMIN_ADJUSTMENT"
    | "VOID_REFUND"

  amount: number
  balanceAfter: number

  betId?: string
  matchId?: string

  description: string
  createdBy?: string
  createdAt: Timestamp
}
```

Rules:

* Negative amount for stake.
* Positive amount for payout, refund, or admin adjustment.
* Never delete wallet transactions.

---

### `leaderboard/{userId}`

Keep this as a denormalized fast-read document.

```ts
type LeaderboardDoc = {
  userId: string
  displayName: string
  balance: number
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalPayout: number
  netProfit: number
  updatedAt: Timestamp
}
```

Update this document inside bet placement and settlement transactions.

---

### `auditLogs/{logId}`

```ts
type AuditLogDoc = {
  actorId?: string
  actorEmail?: string

  action: string
  entityType: "USER" | "MATCH" | "BET" | "WALLET" | "SYSTEM"
  entityId?: string

  before?: unknown
  after?: unknown

  createdAt: Timestamp
}
```

Use audit logs for:

* Match creation
* Match edits
* Odds changes
* Result entry
* Settlement
* Void match
* Admin balance adjustment

---

## 9. Required Indexes

Create composite indexes for:

### Matches

```text
matches
where status in [...]
order by kickoffAt asc
```

### User Bet History

```text
bets
where userId == currentUserId
order by placedAt desc
```

### Match Bets

```text
bets
where matchId == matchId
order by placedAt asc
```

### Leaderboard

```text
leaderboard
order by balance desc
```

Firestore will usually prompt for missing index creation during development.

---

## 10. Security Model

Use both:

1. Firestore Security Rules
2. Server-side validation with Firebase Admin SDK

Client-side users can read safe data directly, but all sensitive writes should go through server-side API routes.

### Client Can Read

Regular users can read:

* their own user profile
* public match list
* their own bets
* leaderboard
* settled match results

Admins can read more.

### Client Cannot Directly Write

Users must not directly write:

* bets
* balances
* wallet transactions
* match results
* settlement status
* audit logs

All of these go through server-side API routes.

---

## 11. Firestore Security Rules Strategy

Use rules to prevent accidental or malicious direct writes.

High-level rules:

```text
- Authenticated active users can read matches.
- Users can read their own bets.
- Users can read leaderboard.
- Users can read their own user document.
- Admins can read admin collections.
- No client can directly create wallet transactions.
- No client can directly update balances.
- No client can directly settle matches.
- No client can directly create audit logs.
```

Use custom role data from `users/{uid}.role`.

Keep rules conservative. Prefer denying writes and routing mutations through server-side logic.

---

## 12. API Routes / Server Actions

Use Next.js route handlers or server actions.

### User APIs

#### `GET /api/me`

Returns current user profile.

#### `GET /api/matches`

Returns matches.

Query options:

```text
upcoming
locked
completed
all
```

Each match should include whether current user has already placed a bet.

#### `GET /api/matches/:id`

Returns match detail.

#### `POST /api/bets`

Places a bet.

Input:

```ts
{
  matchId: string
  pick: "HOME" | "DRAW" | "AWAY"
  stake: number
  predictedHomeScore?: number
  predictedAwayScore?: number
}
```

Must run in a Firestore transaction.

#### `GET /api/my-bets`

Returns current user’s bet history.

#### `GET /api/leaderboard`

Returns leaderboard ordered by balance descending.

---

### Admin APIs

#### `POST /api/admin/matches`

Create match.

#### `PATCH /api/admin/matches/:id`

Edit match.

#### `POST /api/admin/matches/:id/lock`

Lock match manually.

#### `POST /api/admin/matches/:id/result`

Enter result.

Input:

```ts
{
  homeScore: number
  awayScore: number
}
```

#### `POST /api/admin/matches/:id/settle`

Settle all pending bets for a match.

#### `POST /api/admin/matches/:id/void`

Void match and refund pending bets.

#### `POST /api/admin/users/:id/adjust-balance`

Adjust user balance.

Input:

```ts
{
  amount: number
  reason: string
}
```

---

## 13. Bet Placement Transaction

Use a Firestore transaction.

Documents involved:

```text
users/{userId}
matches/{matchId}
bets/{matchId}_{userId}
walletTransactions/{newTransactionId}
leaderboard/{userId}
auditLogs/{newLogId}
```

Algorithm:

```ts
async function placeBet(userId, input) {
  validate input

  runTransaction(async tx => {
    user = tx.get(users/userId)
    match = tx.get(matches/matchId)
    betRef = bets/{matchId}_{userId}
    existingBet = tx.get(betRef)

    serverNow = new Date()

    if user inactive -> throw
    if existingBet exists -> throw
    if serverNow >= match.kickoffAt -> throw
    if match.status not in SCHEDULED/OPEN -> throw
    if user.balance < stake -> throw

    odds = match.odds[pick]
    potentialPayout = stake * odds
    newBalance = user.balance - stake

    tx.set(betRef, betDoc)
    tx.update(userRef, { balance: newBalance })
    tx.update(matchRef, {
      betCount: increment(1),
      totalStaked: increment(stake)
    })
    tx.set(walletTransactionRef, stakeTransaction)
    tx.set(leaderboardRef, updatedLeaderboard, { merge: true })
    tx.set(auditLogRef, log)
  })
}
```

Important:

* Do not trust client-supplied odds.
* Do not trust client-supplied payout.
* Do not trust client-supplied user ID.
* Use server time.
* Use deterministic bet ID to prevent duplicates.

---

## 14. Locking Logic

Implement passive locking.

Before every match list read or bet placement, check whether any matches should be treated as locked.

For bet placement, the true rule is:

```ts
if (Date.now() >= match.kickoffAt.toMillis()) {
  reject bet
}
```

Optionally, update old open matches:

```ts
update all matches where kickoffAt <= now and status in SCHEDULED/OPEN to LOCKED
```

This can be done by:

* admin action
* scheduled endpoint
* opportunistic cleanup when admin opens dashboard

Do not depend on cron for correctness.

---

## 15. Settlement Transaction

Use a Firestore transaction or carefully chunked transactions if many bets exist.

For fewer than 10 users, a single transaction is fine.

Documents involved:

```text
matches/{matchId}
bets/{betId} for each pending bet
users/{userId} for each bettor
walletTransactions/{transactionId}
leaderboard/{userId}
auditLogs/{logId}
```

Algorithm:

```ts
async function settleMatch(matchId, adminUserId) {
  runTransaction(async tx => {
    match = tx.get(matchRef)

    if match.status == SETTLED:
      return

    if result missing:
      throw

    resultPick = match.resultPick ?? calculateFinalResultPick(match.homeScore, match.awayScore)

    pendingBets = query bets where matchId == matchId and status == PENDING

    for each bet:
      if bet.pick == resultPick:
        payout = bet.stake * bet.odds
        newBalance = user.balance + payout

        tx.update(betRef, {
          status: "WON",
          payout,
          settledAt: serverTimestamp()
        })

        tx.update(userRef, {
          balance: newBalance
        })

        tx.set(walletTransactionRef, {
          type: "BET_PAYOUT",
          amount: payout,
          balanceAfter: newBalance
        })

        tx.set(leaderboardRef, updatedStats, { merge: true })
      else:
        tx.update(betRef, {
          status: "LOST",
          payout: 0,
          settledAt: serverTimestamp()
        })

        tx.set(leaderboardRef, updatedStats, { merge: true })

    tx.update(matchRef, {
      status: "SETTLED",
      resultPick,
      settledAt: serverTimestamp()
    })

    tx.set(auditLogRef, settlementLog)
  })
}
```

Idempotency requirement:

* If match is already `SETTLED`, return without writing payouts.
* Only process bets with `status == PENDING`.
* Use unique transaction IDs if needed:

  * `payout_{betId}`

---

## 16. Pages

### `/login`

Sign-in page.

Requirements:

* Login with Firebase Auth.
* After login, check invite and profile.
* If not invited, show blocked message.

### `/matches`

Main match list.

Sections:

* Upcoming
* Locked/live
* Completed/settled

Each card shows:

* Teams
* Group/stage
* Kickoff time
* Status
* Odds
* Existing user bet, if any
* Place bet button if available

### `/matches/[matchId]`

Match details and bet form.

Show:

* Match info
* Countdown
* Odds
* Current balance
* Existing bet
* Bet form if open

### `/my-bets`

User bet history.

Filters:

* Pending
* Won
* Lost
* Voided
* All

### `/leaderboard`

Group leaderboard.

Fields:

* Rank
* Name
* Balance
* Total bets
* Wins
* Losses
* Pending bets
* Net profit

### `/admin`

Admin dashboard.

Show:

* Matches needing result
* Upcoming matches
* Recently settled matches
* Users
* Recent audit logs

### `/admin/matches`

Admin match management.

Actions:

* Create match
* Edit match
* Change odds before kickoff
* Lock match
* Enter result
* Settle match
* Void match

### `/admin/users`

Admin user management.

Actions:

* View users
* Adjust balance with required reason
* Activate/deactivate user

---

## 17. Local Development

Use Firebase Emulator Suite if possible.

Recommended local commands:

```bash
firebase init
firebase emulators:start
npm run dev
```

Use emulators for:

* Auth
* Firestore
* Security Rules testing

---

## 18. Testing Requirements

Minimum tests:

### Bet Placement

* Can place bet before kickoff.
* Cannot place bet after kickoff.
* Cannot bet with insufficient balance.
* Cannot bet twice on same match.
* Bet stores odds at placement time.
* Stake deducts balance.
* Wallet transaction is created.

### Settlement

* HOME result pays HOME bets.
* DRAW result pays DRAW bets.
* AWAY result pays AWAY bets.
* Losing bets get zero payout.
* Settlement cannot pay twice.
* Match status becomes SETTLED.
* Leaderboard updates.

### Admin

* Regular user cannot create match.
* Regular user cannot enter result.
* Regular user cannot settle match.
* Admin adjustment requires reason.
* Admin actions create audit logs.

### Security Rules

* User cannot write their own balance.
* User cannot create wallet transaction.
* User cannot edit bet after placement.
* User cannot write result.
* User can read own bets.
* User cannot read other users’ private bet documents before kickoff if that rule is desired.

---

## 19. Suggested Folder Structure

```text
src/
  app/
    login/
      page.tsx

    matches/
      page.tsx
      [matchId]/
        page.tsx

    my-bets/
      page.tsx

    leaderboard/
      page.tsx

    admin/
      page.tsx
      matches/
        page.tsx
      users/
        page.tsx
      audit-log/
        page.tsx

    api/
      me/
        route.ts
      matches/
        route.ts
      bets/
        route.ts
      leaderboard/
        route.ts
      admin/
        matches/
        route.ts
      cron/
        lock-matches/
          route.ts

  components/
    match-card.tsx
    bet-form.tsx
    leaderboard-table.tsx
    status-badge.tsx
    admin-result-form.tsx

  lib/
    firebase/
      client.ts
      admin.ts
    auth.ts
    roles.ts
    betting.ts
    settlement.ts
    validation.ts
    time.ts

  types/
    firebase.ts
    betting.ts

firestore.rules
firestore.indexes.json
firebase.json
```

---

## 20. Implementation Phases

### Phase 1: Setup

* Create Next.js project.
* Add Tailwind.
* Add Firebase client SDK.
* Add Firebase Admin SDK.
* Configure environment variables.
* Add login page.

Acceptance criteria:

* User can log in.
* App can read current Firebase user.
* Protected pages redirect unauthenticated users.

---

### Phase 2: Firestore Model

* Create Firestore collections.
* Add security rules.
* Add invite/profile creation logic.
* Add admin role.

Acceptance criteria:

* Only invited users can enter.
* Admin can access `/admin`.
* Regular users cannot access `/admin`.

---

### Phase 3: Matches

* Add admin match creation.
* Add match list page.
* Add match detail page.
* Seed initial World Cup matches manually.

Acceptance criteria:

* Users can view upcoming matches.
* Admin can create/edit matches.
* Kickoff times display correctly.

---

### Phase 4: Betting

* Add bet placement API.
* Use Firestore transaction.
* Deduct balance.
* Create wallet transaction.
* Update leaderboard.

Acceptance criteria:

* User can place valid bet.
* Duplicate bet is blocked.
* Over-betting is blocked.
* After-kickoff bet is blocked.

---

### Phase 5: Result and Settlement

* Add result entry form.
* Add settlement route.
* Update bet statuses.
* Add payout transactions.
* Update leaderboard.

Acceptance criteria:

* Admin can settle a match.
* Winners receive points.
* Losers receive no payout.
* Settlement is idempotent.

---

### Phase 6: Polish and Deploy

* Improve mobile UI.
* Add loading/error states.
* Add audit log page.
* Deploy to Vercel.
* Configure production Firebase settings.

Acceptance criteria:

* Production app works end to end.
* Friends can log in and bet.
* Admin can enter results and settle bets.

---

## 21. LLM Implementation Instructions

When implementing:

1. Use Firebase Auth and Firestore, not Supabase.
2. Use Firestore transactions for bet placement and settlement.
3. Do not allow direct client writes for sensitive operations.
4. Use server-side Firebase Admin SDK for mutations.
5. Keep the app invite-only.
6. Keep the app points-only.
7. Store denormalized fields where useful.
8. Use deterministic bet IDs to prevent duplicates.
9. Store odds on each bet at placement time.
10. Never trust client time, odds, payout, balance, or user ID.
11. Make settlement idempotent.
12. Implement the simplest working MVP first.

The first working version should support this full flow:

```text
Admin creates match
User places bet
Kickoff locks betting
Admin enters result
Admin settles match
Leaderboard updates
User sees bet result
```
