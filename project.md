# Implementation Specification: Private World Cup Friends Betting App

## 1. Project Summary

Build a private, invite-only web app for a small group of friends to place fun bets on upcoming World Cup matches.

The app is for fewer than 10 users. It should use virtual points only. It must not process real-money payments, withdrawals, deposits, or public wagering.

The core product should let users:

1. Log in.
2. See upcoming World Cup matches.
3. Place a bet before a match starts.
4. Automatically lock betting when the match starts.
5. Let an admin enter or verify match results.
6. Settle bets and update user balances.
7. Show leaderboard and bet history.

The app should prioritize correctness, auditability, and simplicity over complex betting features.

---

## 2. Recommended Stack

### Frontend and Backend

Use:

* Next.js with App Router
* TypeScript
* Tailwind CSS
* Supabase Auth
* Supabase Postgres
* Supabase Row Level Security
* Vercel hosting
* Supabase hosted database

Suggested libraries:

* `@supabase/supabase-js`
* `@supabase/ssr`
* `zod`
* `date-fns` or `luxon`
* `clsx`
* `tailwind-merge`
* Optional: `shadcn/ui`

Do not use Google Sheets.

---

## 3. Hosting Plan

### Production Hosting

Use:

* Vercel for the Next.js application
* Supabase for database, authentication, and server-side API access
* GitHub for source control and Vercel deployments

### Environments

Create:

1. Local development
2. Production

Environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
ADMIN_EMAILS=
```

Rules:

* `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be exposed to the browser.
* `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.
* Never expose the service role key in frontend code.
* Use `CRON_SECRET` to protect scheduled admin endpoints.
* `ADMIN_EMAILS` is a comma-separated list of admin emails.

### Deployment Flow

1. Push code to GitHub.
2. Connect GitHub repo to Vercel.
3. Add environment variables in Vercel.
4. Create Supabase project.
5. Run SQL migrations in Supabase.
6. Configure Supabase Auth redirect URLs.
7. Deploy production app.

### Scheduled Jobs

Because this is a small app, do not rely only on scheduled jobs.

Implement lock and settlement logic in two ways:

1. Passive enforcement:

   * Every API route that reads or writes match/bet data must check whether matches should be locked.
   * If `now >= kickoff_at`, betting must be rejected even if `matches.status` has not been updated yet.

2. Optional scheduled job:

   * A Vercel Cron endpoint can run once per day to clean up statuses.
   * This is only a helper, not the source of truth.

---

## 4. Scope

### In Scope for MVP

The MVP should support:

* Invite-only users
* Login via email magic link or email/password
* Admin-created users or allowlisted emails
* World Cup match list
* Betting on match result: home win, draw, away win
* Optional score prediction
* Point-based wallet
* Bet locking at kickoff
* Admin result entry
* Automatic settlement
* Leaderboard
* User bet history
* Admin audit log

### Out of Scope for MVP

Do not implement:

* Real-money payments
* Deposits or withdrawals
* Public registration
* Complex odds markets
* Parlays or accumulators
* Live in-play betting
* Cash-out
* External sportsbook integrations
* Automated scraping unless explicitly added later
* Mobile app
* Push notifications
* Multi-league support beyond World Cup

---

## 5. Product Rules

### Currency

Use virtual points only.

Default starting balance:

```text
1000 points per user
```

Point balances are internal game credits and have no monetary value.

### Match Betting

For MVP, each user can place one primary bet per match.

Supported market:

```text
Match result after regular time:
- HOME
- DRAW
- AWAY
```

For knockout matches, MVP should still settle based on regular-time result unless the admin configures otherwise.

Optional score prediction can be added as a separate fun field:

```text
predicted_home_score
predicted_away_score
```

Score prediction does not affect the primary bet unless explicitly enabled.

### Bet Locking

A bet is valid only if:

```text
current server time < match.kickoff_at
match.status = OPEN or SCHEDULED
user has enough available points
user has not already placed a bet on the same market for the same match
```

Once kickoff time is reached:

```text
No new bets allowed.
No edits allowed.
No cancellations allowed.
```

Server-side validation is mandatory. Client-side validation is only for UX.

### Settlement

When a result is entered:

1. Determine winning outcome:

   * home score > away score = HOME
   * home score = away score = DRAW
   * home score < away score = AWAY

2. For each bet:

   * If user pick matches winning outcome:

     * bet status = WON
     * payout = stake * odds
   * Otherwise:

     * bet status = LOST
     * payout = 0

3. Write wallet transactions:

   * Stake should be deducted when bet is placed.
   * Payout should be credited when bet wins.
   * Lost bets receive no additional transaction.

4. Mark match as SETTLED.

Settlement must be idempotent. Running settlement twice must not duplicate payouts.

### Odds

Use simple fixed odds for MVP.

Default odds:

```text
HOME: 2.0
DRAW: 3.0
AWAY: 2.0
```

Admin can edit odds before kickoff.

Once any bet exists for a match, changing odds should not change existing bets. Each bet stores the odds at the time of placement.

### Leaderboard

Rank users by:

```text
current balance descending
```

Also display:

* total bets
* won bets
* lost bets
* pending bets
* total staked
* total payout
* net profit

---

## 6. User Roles

### Regular User

Can:

* View matches
* View odds
* Place bets before kickoff
* View own bets
* View leaderboard
* View settled results

Cannot:

* Edit matches
* Enter results
* Change odds
* Settle bets
* View private admin audit details

### Admin

Can:

* Create/edit matches
* Import matches manually
* Change odds before kickoff
* Lock matches
* Enter results
* Settle matches
* Void a match
* Adjust user balances with reason
* View audit logs

---

## 7. Main Pages

### Public / Auth Pages

#### `/login`

Purpose:

* Let users sign in.

Requirements:

* Email magic link or email/password.
* Show friendly message if email is not invited.
* Redirect logged-in users to `/matches`.

---

### User Pages

#### `/matches`

Purpose:

* Main page showing World Cup matches.

Sections:

1. Upcoming matches
2. Locked/live matches
3. Completed/settled matches

Each match card should show:

* Home team
* Away team
* Kickoff time in user’s local time
* Group/stage
* Status
* Odds
* User’s existing bet, if any
* Button to place bet if allowed

Actions:

* Click match to open detail page.

#### `/matches/[matchId]`

Purpose:

* Match detail and bet placement.

Show:

* Match info
* Countdown until lock
* Betting options
* User’s current balance
* Existing bet if already placed
* Bet history for this match after kickoff, if desired

Bet form:

* Pick: HOME / DRAW / AWAY
* Stake
* Optional score prediction
* Confirm button

Validation:

* Stake must be positive.
* Stake must be less than or equal to user balance.
* Betting must be before kickoff.
* User can only have one active bet for this match market.

#### `/my-bets`

Purpose:

* Show user’s bet history.

Filters:

* Pending
* Won
* Lost
* Voided
* All

Columns/cards:

* Match
* Pick
* Stake
* Odds
* Potential payout
* Status
* Result
* Created time

#### `/leaderboard`

Purpose:

* Show group standings.

Fields:

* Rank
* User display name
* Current balance
* Total bets
* Wins
* Losses
* Pending
* Net profit

---

### Admin Pages

#### `/admin`

Purpose:

* Admin dashboard.

Show:

* Matches needing result entry
* Upcoming matches
* Recently settled matches
* Users and balances
* Recent audit log

#### `/admin/matches`

Purpose:

* Manage matches.

Admin can:

* Create match
* Edit match before kickoff
* Set odds
* Lock match manually
* Void match
* Enter result
* Trigger settlement

#### `/admin/users`

Purpose:

* Manage invited users and balances.

Admin can:

* View users
* Set display name
* Mark user active/inactive
* Adjust balance with required reason

#### `/admin/audit-log`

Purpose:

* Show important admin actions and settlement actions.

---

## 8. Database Schema

Use Supabase Postgres.

### Enum Types

Create enums:

```sql
create type app_role as enum ('USER', 'ADMIN');

create type match_status as enum (
  'SCHEDULED',
  'OPEN',
  'LOCKED',
  'LIVE',
  'COMPLETED',
  'SETTLED',
  'VOIDED'
);

create type bet_pick as enum ('HOME', 'DRAW', 'AWAY');

create type bet_status as enum (
  'PENDING',
  'WON',
  'LOST',
  'VOIDED'
);

create type transaction_type as enum (
  'INITIAL_CREDIT',
  'BET_STAKE',
  'BET_PAYOUT',
  'ADMIN_ADJUSTMENT',
  'VOID_REFUND'
);
```

---

### `profiles`

Stores app-level user profiles.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role app_role not null default 'USER',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

### `matches`

Stores World Cup fixtures.

```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  home_team text not null,
  away_team text not null,
  home_team_code text,
  away_team_code text,
  group_name text,
  stage text not null default 'GROUP',
  kickoff_at timestamptz not null,
  status match_status not null default 'SCHEDULED',

  home_odds numeric(8,2) not null default 2.00,
  draw_odds numeric(8,2) not null default 3.00,
  away_odds numeric(8,2) not null default 2.00,

  home_score integer,
  away_score integer,
  result_pick bet_pick,

  locked_at timestamptz,
  completed_at timestamptz,
  settled_at timestamptz,

  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint different_teams check (home_team <> away_team),
  constraint kickoff_reasonable check (kickoff_at > '2026-01-01'::timestamptz)
);
```

---

### `bets`

Stores user bets.

```sql
create table bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,

  pick bet_pick not null,
  stake numeric(12,2) not null,
  odds numeric(8,2) not null,
  potential_payout numeric(12,2) generated always as (stake * odds) stored,

  predicted_home_score integer,
  predicted_away_score integer,

  status bet_status not null default 'PENDING',
  payout numeric(12,2) not null default 0,

  placed_at timestamptz not null default now(),
  settled_at timestamptz,

  constraint positive_stake check (stake > 0),
  constraint nonnegative_prediction check (
    predicted_home_score is null or predicted_home_score >= 0
  ),
  constraint nonnegative_prediction_away check (
    predicted_away_score is null or predicted_away_score >= 0
  )
);
```

Unique active bet rule:

```sql
create unique index one_bet_per_user_per_match
on bets(user_id, match_id)
where status in ('PENDING', 'WON', 'LOST');
```

---

### `wallet_transactions`

Use ledger transactions instead of directly editing balances.

```sql
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bet_id uuid references bets(id) on delete set null,
  match_id uuid references matches(id) on delete set null,

  type transaction_type not null,
  amount numeric(12,2) not null,
  description text not null,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  constraint nonzero_amount check (amount <> 0)
);
```

Balance is calculated as:

```sql
sum(wallet_transactions.amount)
```

Do not store editable balance directly unless using a cached materialized value later.

---

### `invites`

Stores allowlisted emails.

```sql
create table invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  role app_role not null default 'USER',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

### `audit_logs`

Stores sensitive actions.

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
```

---

## 9. Database Views and Functions

### User Balance View

```sql
create view user_balances as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(w.amount), 0) as balance
from profiles p
left join wallet_transactions w on w.user_id = p.id
group by p.id, p.display_name;
```

### Leaderboard View

```sql
create view leaderboard as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(w.amount), 0) as balance,
  count(b.id) as total_bets,
  count(b.id) filter (where b.status = 'WON') as won_bets,
  count(b.id) filter (where b.status = 'LOST') as lost_bets,
  count(b.id) filter (where b.status = 'PENDING') as pending_bets,
  coalesce(sum(b.stake), 0) as total_staked,
  coalesce(sum(b.payout), 0) as total_payout
from profiles p
left join wallet_transactions w on w.user_id = p.id
left join bets b on b.user_id = p.id
group by p.id, p.display_name
order by balance desc;
```

---

## 10. Row Level Security

Enable RLS on all app tables.

General policies:

### `profiles`

* Users can read their own profile.
* Users can read public leaderboard-safe profile fields for all active users.
* Admins can read and update all profiles.

### `matches`

* All active authenticated users can read matches.
* Only admins can insert/update/delete matches.

### `bets`

* Users can read their own bets.
* Users can create their own bets only through a secure server action or RPC.
* Users cannot update or delete bets after creation.
* Admins can read all bets.
* Admins should not directly edit bets except through settlement/void functions.

### `wallet_transactions`

* Users can read their own wallet transactions.
* Users cannot insert/update/delete wallet transactions.
* Only server-side privileged logic can create wallet transactions.
* Admins can read all transactions.

### `audit_logs`

* Admins can read audit logs.
* Regular users cannot read audit logs.

Important:

Bet placement, settlement, voiding, and admin adjustments should be done through server-side functions/API routes using controlled logic.

---

## 11. API / Server Actions

Use Next.js server actions or route handlers. Prefer server-side validation with Zod.

### Auth

#### `GET /login`

Login page.

#### `POST /auth/callback`

Handles Supabase auth callback if needed.

---

### User APIs

#### `GET /api/matches`

Returns list of matches.

Query params:

```text
status=upcoming|locked|completed|all
```

Must include whether current user has placed a bet.

#### `GET /api/matches/:id`

Returns match detail, odds, status, and user bet if any.

#### `POST /api/bets`

Creates a bet.

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

Server rules:

1. User must be authenticated.
2. User must be active.
3. Match must exist.
4. Current time must be before `kickoff_at`.
5. Match must not be locked, completed, settled, or voided.
6. Stake must be positive.
7. User balance must be sufficient.
8. User must not already have an active bet for match.
9. Odds must be copied from match at the time of bet.
10. Insert bet.
11. Insert wallet transaction with negative stake.
12. Insert audit log or user activity log.

Use a database transaction or Postgres RPC to guarantee atomicity.

#### `GET /api/my-bets`

Returns current user’s bets.

#### `GET /api/leaderboard`

Returns leaderboard.

---

### Admin APIs

All admin APIs require admin role.

#### `POST /api/admin/matches`

Create match.

Input:

```ts
{
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  groupName?: string
  stage: string
  kickoffAt: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
}
```

#### `PATCH /api/admin/matches/:id`

Edit match.

Rules:

* Cannot edit teams/kickoff/odds after kickoff unless admin confirms and audit log is written.
* Existing bets keep their stored odds.

#### `POST /api/admin/matches/:id/lock`

Manually lock match.

#### `POST /api/admin/matches/:id/result`

Enter result.

Input:

```ts
{
  homeScore: number
  awayScore: number
}
```

Rules:

* Scores must be non-negative integers.
* Store `result_pick`.
* Set status to `COMPLETED`.

#### `POST /api/admin/matches/:id/settle`

Settle all pending bets.

Rules:

* Must be idempotent.
* Do not duplicate payouts.
* Only settle if result exists.
* Set match status to `SETTLED`.

#### `POST /api/admin/matches/:id/void`

Void match.

Rules:

* Mark match as `VOIDED`.
* Mark pending bets as `VOIDED`.
* Refund stakes.
* Do not refund already-settled bets unless implementing admin reversal later.

#### `POST /api/admin/users/:id/adjust-balance`

Input:

```ts
{
  amount: number
  reason: string
}
```

Rules:

* Reason is required.
* Insert wallet transaction.
* Insert audit log.

---

## 12. Business Logic Details

### Bet Placement Algorithm

Pseudo-code:

```ts
async function placeBet(userId, input) {
  validate input with zod

  begin transaction

  user = get active user
  match = get match for update
  now = current server time

  if now >= match.kickoff_at:
    lock match if not locked
    throw "Betting is closed"

  if match.status in ["LOCKED", "LIVE", "COMPLETED", "SETTLED", "VOIDED"]:
    throw "Betting is closed"

  existingBet = find active bet for user and match
  if existingBet:
    throw "You already placed a bet for this match"

  balance = sum wallet transactions for user
  if balance < stake:
    throw "Insufficient balance"

  odds = match odds matching selected pick

  create bet
  create wallet transaction amount = -stake

  commit

  return created bet
}
```

### Locking Algorithm

Pseudo-code:

```ts
async function lockStartedMatches() {
  update matches
  set status = 'LOCKED',
      locked_at = now()
  where kickoff_at <= now()
    and status in ('SCHEDULED', 'OPEN')
}
```

Even if this job fails, `placeBet` must still reject bets after kickoff.

### Settlement Algorithm

Pseudo-code:

```ts
async function settleMatch(matchId) {
  begin transaction

  match = get match for update

  if match.status = 'SETTLED':
    return already settled

  if match.home_score is null or match.away_score is null:
    throw "Result missing"

  resultPick = calculate result

  pendingBets = get pending bets for match for update

  for each bet:
    if bet.pick == resultPick:
      payout = bet.stake * bet.odds
      update bet status WON, payout, settled_at
      insert wallet transaction BET_PAYOUT amount = payout
    else:
      update bet status LOST, payout = 0, settled_at

  update match status SETTLED, settled_at

  insert audit log

  commit
}
```

---

## 13. Timezone Requirements

Store all times in UTC using `timestamptz`.

Display times in the user’s local timezone.

For this project owner, the default display timezone can be:

```text
Asia/Ho_Chi_Minh
```

But the frontend should ideally use browser timezone detection.

Kickoff lock must use server time, not browser time.

---

## 14. Match Data Strategy

For MVP, use manual admin entry or seed data.

Recommended approach:

1. Create an admin-only seed page or script.
2. Add World Cup fixtures manually with:

   * teams
   * team codes
   * stage/group
   * kickoff time
   * default odds

Later, optionally add an external sports API integration.

Do not block MVP on automatic schedule import.

Seed script should be repeatable:

* If `external_id` exists, update match.
* If not, insert match.

---

## 15. UI Requirements

### Design Style

Simple, mobile-friendly, fun.

Suggested style:

* Card-based layout
* Country/team badges or emoji flags if easy
* Clear countdown before match lock
* Strong status badges:

  * Open
  * Locked
  * Completed
  * Settled
  * Voided

### Match Card

Show:

```text
Brazil vs Scotland
Group C
Kickoff: Jun 25, 05:00
Status: Open
Your bet: Brazil, 100 pts
```

Buttons:

* `Place Bet`
* `View Bet`
* Admin only: `Enter Result`, `Settle`

### Bet Form

Fields:

* Pick
* Stake
* Optional score prediction

Show:

* Current balance
* Potential payout
* Lock time

Confirmation text:

```text
You are betting 100 points on Brazil at 2.00 odds.
Potential payout: 200 points.
Bets cannot be changed after submission.
```

### Leaderboard

Use a table on desktop and cards on mobile.

Fields:

* Rank
* Name
* Balance
* W-L
* Pending
* Net

---

## 16. Security Requirements

1. App must be invite-only.
2. Do not allow public signup unless email is in `invites`.
3. All sensitive actions must be validated server-side.
4. Use RLS on all tables.
5. Service role key must never be exposed to browser.
6. Admin checks must happen server-side.
7. Users cannot edit bets after placement.
8. Users cannot create wallet transactions directly.
9. Users cannot update match results.
10. All admin changes must create audit logs.

---

## 17. Anti-Cheat and Integrity Requirements

Important risks:

* User places bet after kickoff.
* User edits bet after seeing result.
* Admin accidentally settles twice.
* Balance becomes inconsistent.
* Odds change after bet placement.

Required protections:

1. Server-side kickoff check.
2. Immutable bet records after placement.
3. Store odds on bet at placement time.
4. Ledger-based wallet transactions.
5. Idempotent settlement.
6. Audit logs for admin actions.
7. Unique constraint preventing duplicate active bets.
8. Do not trust client time.
9. Do not trust client-calculated payout.

---

## 18. Error Messages

Use friendly error messages:

* `Betting is closed for this match.`
* `You already placed a bet on this match.`
* `Insufficient balance.`
* `Invalid stake amount.`
* `Only admins can perform this action.`
* `This match has already been settled.`
* `Result must be entered before settlement.`

---

## 19. Testing Requirements

Add tests for core business logic.

Minimum test cases:

### Bet Placement

* User can place bet before kickoff.
* User cannot place bet after kickoff.
* User cannot bet more than balance.
* User cannot place duplicate bet on same match.
* Bet stores odds at placement time.
* Stake transaction is created.

### Locking

* Match locks after kickoff.
* Open match remains open before kickoff.
* Bet API rejects after kickoff even if status still says open.

### Settlement

* Winning bet receives payout.
* Losing bet receives no payout.
* Draw result settles DRAW bets.
* Settlement is idempotent.
* Match becomes SETTLED.
* Wallet balance is correct after settlement.

### Admin

* Non-admin cannot create match.
* Non-admin cannot enter result.
* Admin adjustment requires reason.
* Admin actions create audit log.

---

## 20. Suggested Folder Structure

```text
src/
  app/
    login/
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
      users/
      audit-log/
    api/
      bets/
        route.ts
      matches/
        route.ts
      leaderboard/
        route.ts
      admin/
        matches/
        users/
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
    supabase/
      client.ts
      server.ts
      admin.ts
    auth.ts
    roles.ts
    betting.ts
    settlement.ts
    time.ts
    validation.ts

  types/
    database.ts
    betting.ts

supabase/
  migrations/
  seed.sql
```

---

## 21. Implementation Phases

### Phase 1: Project Setup

* Create Next.js app.
* Configure TypeScript, Tailwind, linting.
* Create Supabase project.
* Add environment variables.
* Implement Supabase client/server helpers.
* Add auth pages.

Acceptance criteria:

* User can log in.
* App can read current user session.
* Protected pages redirect unauthenticated users.

---

### Phase 2: Database and Auth

* Add schema migrations.
* Enable RLS.
* Add profile creation flow.
* Add invites table.
* Add admin role.
* Seed admin user.

Acceptance criteria:

* Only invited users can access app.
* Admin user can access `/admin`.
* Regular user cannot access `/admin`.

---

### Phase 3: Matches

* Add matches table.
* Add admin match creation.
* Add match list page.
* Add match detail page.
* Seed initial World Cup matches.

Acceptance criteria:

* Users can view upcoming matches.
* Admin can create/edit matches.
* Kickoff times display correctly.

---

### Phase 4: Betting

* Add bet placement API.
* Add wallet transactions.
* Add user balance view.
* Add bet form.
* Add duplicate bet protection.

Acceptance criteria:

* User can place valid bet.
* Stake is deducted.
* User cannot overbet.
* User cannot bet twice on same match.
* User cannot bet after kickoff.

---

### Phase 5: Results and Settlement

* Add admin result form.
* Add settlement logic.
* Add bet status display.
* Add payout transactions.
* Add idempotency.

Acceptance criteria:

* Admin can enter result.
* Admin can settle match.
* Winning users receive points.
* Losing users do not.
* Running settlement twice does not duplicate payout.

---

### Phase 6: Leaderboard and History

* Add leaderboard view/page.
* Add my bets page.
* Add filters.

Acceptance criteria:

* Leaderboard reflects balances.
* User can view all their bets.
* Bet statuses are clear.

---

### Phase 7: Polish and Deployment

* Add responsive design.
* Add loading/error states.
* Add audit log UI.
* Deploy to Vercel.
* Verify production auth redirect.
* Verify environment variables.

Acceptance criteria:

* Production app works end to end.
* Admin can manage matches.
* Users can bet from mobile.
* Settlement works in production.

---

## 22. LLM Implementation Instructions

When implementing this project:

1. Build the MVP first.
2. Do not add real-money features.
3. Use TypeScript everywhere.
4. Keep business logic server-side.
5. Never trust client-provided time, odds, payout, user ID, or balance.
6. Use database transactions or Supabase RPC for bet placement and settlement.
7. Keep all wallet changes in `wallet_transactions`.
8. Make settlement idempotent.
9. Use simple UI before adding visual polish.
10. Ask before adding external sports API integration.
11. Do not implement complex betting markets until MVP is working.

Start by generating:

1. Supabase SQL migration files.
2. Next.js app structure.
3. Supabase auth helpers.
4. Protected route handling.
5. Match list page.
6. Admin match creation page.
7. Bet placement route.
8. Settlement route.
9. Leaderboard page.

The first working version should let an admin manually create a match, a user place a bet, the admin enter a result, and the app settle the bet correctly.
