export type UserRole = "USER" | "ADMIN"
export type MatchStage =
  | "GROUP"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL"
export type MatchStatus =
  | "SCHEDULED"
  | "OPEN"
  | "LOCKED"
  | "LIVE"
  | "COMPLETED"
  | "SETTLED"
  | "VOIDED"
export type BetPick = "HOME" | "DRAW" | "AWAY" | "NO_BET"
export type BetStatus = "PENDING" | "WON" | "LOST" | "VOIDED"
export type WalletTransactionType =
  | "INITIAL_CREDIT"
  | "BET_STAKE"
  | "BET_STAKE_ADJUSTMENT"
  | "BET_PAYOUT"
  | "ADMIN_ADJUSTMENT"
  | "VOID_REFUND"

export type UserDoc = {
  email: string
  displayName: string
  role: UserRole
  isActive: boolean
  groupId?: string
  groupName?: string
  balance: number
  startingBalance: number
  createdAt: FirebaseDate
  updatedAt: FirebaseDate
}

export type GroupDoc = {
  name: string
  createdBy?: string
  createdAt: FirebaseDate
  updatedBy?: string
  updatedAt: FirebaseDate
}

export type InviteDoc = {
  email: string
  displayName?: string
  role: UserRole
  acceptedBy?: string
  acceptedAt?: FirebaseDate
  createdBy?: string
  createdAt: FirebaseDate
  updatedBy?: string
  updatedAt?: FirebaseDate
}

export type MatchDoc = {
  externalId?: string
  source?: "espn" | "thestatsapi" | "manual"
  sourceUpdatedAt?: FirebaseDate
  matchNumber?: number
  venueName?: string
  hostCity?: string
  teamsConfirmed?: boolean
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  groupName?: string
  stage: MatchStage
  kickoffAt: FirebaseDate
  status: MatchStatus
  homeScore?: number
  awayScore?: number
  homeShootoutScore?: number
  awayShootoutScore?: number
  resultPick?: BetPick
  resultSourceDetail?: string
  betCount: number
  totalStaked: number
  lockedAt?: FirebaseDate
  completedAt?: FirebaseDate
  settledAt?: FirebaseDate
  createdBy?: string
  updatedBy?: string
  createdAt: FirebaseDate
  updatedAt: FirebaseDate
}

export type BetDoc = {
  userId: string
  userEmail: string
  userDisplayName: string
  groupId?: string
  groupName?: string
  matchId: string
  matchLabel: string
  homeTeam: string
  awayTeam: string
  homeTeamCode?: string
  awayTeamCode?: string
  kickoffAt: FirebaseDate
  pick: BetPick
  stake: number
  potentialPayout: number
  fundContribution: number
  status: BetStatus
  payout: number
  placedAt: FirebaseDate
  updatedAt: FirebaseDate
  settledAt?: FirebaseDate
}

export type LeaderboardDoc = {
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
  updatedAt: FirebaseDate
}

export type Serialized<T> = {
  [K in keyof T]: T[K] extends FirebaseDate | undefined
    ? string | undefined
    : T[K] extends FirebaseDate
      ? string
      : T[K] extends object | undefined
        ? Serialized<NonNullable<T[K]>> | undefined
        : T[K]
}

export type FirebaseDate = {
  toDate?: () => Date
  toMillis?: () => number
  seconds?: number
  nanoseconds?: number
}
