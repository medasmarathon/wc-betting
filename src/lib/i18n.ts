import type { BetPick } from "@/types/betting"

export type Locale = "en" | "vi"

export const DEFAULT_LOCALE: Locale = "en"
export const LOCALE_STORAGE_KEY = "wc-betting-locale"

export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  vi: "vi-VN",
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  vi: "VI",
}

export const messages = {
  en: {
    app: {
      name: "Happy BWID",
      description: "Private World Cup betting pool using points only",
    },
    auth: {
      loadingProfile: "Loading profile",
      redirecting: "Redirecting",
      adminRequired: "Admin access required.",
      signInTitle: "Sign in",
      signInSubtitle: "Invite-only, points-only World Cup pool.",
      signInWithGoogle: "Continue with Google",
      signInFailed: "Sign in failed",
      signOut: "Sign out",
    },
    nav: {
      matches: "Matches",
      myBets: "My bets",
      leaderboard: "Leaderboard",
      admin: "Admin",
      back: "Back",
      language: "Language",
    },
    common: {
      allDates: "All dates",
      today: "Today",
      previous: "Previous",
      next: "Next",
      selected: "Selected",
      chooseDate: "Choose date",
      dateNavigation: "Date navigation",
      unit: "points",
      draw: "Draw",
      noBet: "No bet",
      tbd: "TBD",
      homeTeam: "Home team",
      awayTeam: "Away team",
    },
    matches: {
      title: "Matches",
      subtitle: "Place or edit one pre-kickoff bet per match.",
      dateTitle: "Match date",
      loading: "Loading matches...",
      refreshing: "Refreshing matches...",
      emptyForDate: "No matches on {date} for this view.",
      empty: "No matches for this view.",
      views: {
        all: "All",
        upcoming: "Upcoming",
        locked: "Locked",
        completed: "Completed",
      },
    },
    bets: {
      loading: "Loading bets...",
      stake: "Stake",
      stakeNote: "If your pick is correct, your stake is refunded. If not, it goes into the party fund.",
      place: "Place bet",
      edit: "Edit bet",
      closeSlip: "Close bet slip",
      save: "Save changes",
      saveFailed: "Unable to save bet",
      saved: "Bet {action} on {pick}.",
      placed: "placed",
      updated: "updated",
      yourBet: "Your bet",
      lastUpdated: "Last updated {date}",
      pendingTitle: "Upcoming bets",
      previousTitle: "Previous bets",
      emptyPending: "No pending bets{suffix}.",
      emptySettled: "No settled bets{suffix}.",
      onDate: " on {date}",
    },
    myBets: {
      title: "My bets",
      allTitle: "All bets",
      subtitle: "Track pending picks and settled party fund results.",
    },
    leaderboard: {
      title: "Leaderboard",
      loading: "Loading leaderboard...",
      partyFund: "Party fund",
      groupFund: "{group} fund",
    },
    table: {
      user: "User",
      match: "Match",
      kickoff: "Kickoff",
      pick: "Pick",
      stake: "Stake",
      result: "Result",
      status: "Status",
      placed: "Placed",
      updated: "Updated",
      refund: "Refund",
      fund: "Fund",
      rank: "Rank",
      name: "Name",
      balance: "Balance",
      bets: "Bets",
      wins: "Wins",
      losses: "Losses",
      pending: "Pending",
    },
    errors: {
      teamsUnconfirmed: "Teams are not confirmed for this match",
      bettingLocked: "Betting is locked for this match",
      matchNotOpen: "This match is not open for betting",
      stakeExact: "Stake must be exactly {amount}",
      editPendingOnly: "Only pending bets can be edited",
      drawNotAvailable: "Draw is not available for knockout matches",
      insufficientBalance: "Insufficient balance",
      userNotFound: "User profile not found",
      matchNotFound: "Match not found",
    },
    status: {
      SCHEDULED: "Scheduled",
      OPEN: "Open",
      LOCKED: "Locked",
      LIVE: "Live",
      COMPLETED: "Completed",
      SETTLED: "Settled",
      VOIDED: "Voided",
      PENDING: "Pending",
      WON: "Won",
      LOST: "Lost",
    },
  },
  vi: {
    app: {
      name: "World Cup Bets",
      description: "Ứng dụng dự đoán World Cup nội bộ, chỉ dùng đơn vị",
    },
    auth: {
      loadingProfile: "Đang tải hồ sơ",
      redirecting: "Đang chuyển hướng",
      adminRequired: "Cần quyền quản trị.",
      signInTitle: "Đăng nhập",
      signInSubtitle: "Nhóm World Cup riêng tư, chỉ dùng đơn vị.",
      signInWithGoogle: "Tiếp tục với Google",
      signInFailed: "Đăng nhập thất bại",
      signOut: "Đăng xuất",
    },
    nav: {
      matches: "Trận đấu",
      myBets: "Cược của tôi",
      leaderboard: "Bảng xếp hạng",
      admin: "Quản trị",
      back: "Quay lại",
      language: "Ngôn ngữ",
    },
    common: {
      allDates: "Tất cả ngày",
      today: "Hôm nay",
      previous: "Trước",
      next: "Tiếp",
      selected: "Đang chọn",
      chooseDate: "Chọn ngày",
      dateNavigation: "Điều hướng ngày",
      unit: "đơn vị",
      draw: "Hòa",
      noBet: "Không đặt",
      tbd: "Chưa xác định",
      homeTeam: "Đội nhà",
      awayTeam: "Đội khách",
    },
    matches: {
      title: "Trận đấu",
      subtitle: "Đặt hoặc sửa một lựa chọn trước giờ bóng lăn.",
      dateTitle: "Ngày thi đấu",
      loading: "Đang tải trận đấu...",
      refreshing: "Đang cập nhật trận đấu...",
      emptyForDate: "Không có trận đấu vào {date} trong chế độ này.",
      empty: "Không có trận đấu trong chế độ này.",
      views: {
        all: "Tất cả",
        upcoming: "Sắp diễn ra",
        locked: "Đã khóa",
        completed: "Đã xong",
      },
    },
    bets: {
      loading: "Đang tải cược...",
      stake: "Mức cược",
      stakeNote: "Nếu chọn đúng, bạn được hoàn lại mức cược. Nếu sai, mức cược chuyển vào quỹ chung.",
      place: "Đặt cược",
      edit: "Sửa cược",
      closeSlip: "Đóng phiếu cược",
      save: "Lưu thay đổi",
      saveFailed: "Không thể lưu cược",
      saved: "Cược đã {action} cho {pick}.",
      placed: "đặt",
      updated: "cập nhật",
      yourBet: "Cược của bạn",
      lastUpdated: "Cập nhật lần cuối {date}",
      pendingTitle: "Cược sắp diễn ra",
      previousTitle: "Cược đã xong",
      emptyPending: "Không có cược đang chờ{suffix}.",
      emptySettled: "Không có cược đã xong{suffix}.",
      onDate: " vào {date}",
    },
    myBets: {
      title: "Cược của tôi",
      allTitle: "Tất cả cược",
      subtitle: "Theo dõi lựa chọn đang chờ và kết quả quỹ chung.",
    },
    leaderboard: {
      title: "Bảng xếp hạng",
      loading: "Đang tải bảng xếp hạng...",
      partyFund: "Quỹ chung",
      groupFund: "Quỹ nhóm {group}",
    },
    table: {
      user: "Người chơi",
      match: "Trận",
      kickoff: "Giờ đá",
      pick: "Lựa chọn",
      stake: "Cược",
      result: "Kết quả",
      status: "Trạng thái",
      placed: "Đã đặt",
      updated: "Cập nhật",
      refund: "Hoàn lại",
      fund: "Quỹ",
      rank: "Hạng",
      name: "Tên",
      balance: "Số dư",
      bets: "Cược",
      wins: "Thắng",
      losses: "Thua",
      pending: "Đang chờ",
    },
    errors: {
      teamsUnconfirmed: "Hai đội chưa được xác nhận cho trận này",
      bettingLocked: "Cược đã khóa cho trận này",
      matchNotOpen: "Trận này chưa mở cược",
      stakeExact: "Mức cược phải đúng {amount}",
      editPendingOnly: "Chỉ có thể sửa cược đang chờ",
      drawNotAvailable: "Không thể cược hòa ở vòng loại trực tiếp",
      insufficientBalance: "Số dư không đủ",
      userNotFound: "Không tìm thấy hồ sơ người dùng",
      matchNotFound: "Không tìm thấy trận đấu",
    },
    status: {
      SCHEDULED: "Sắp mở",
      OPEN: "Đang mở",
      LOCKED: "Đã khóa",
      LIVE: "Đang đá",
      COMPLETED: "Đã xong",
      SETTLED: "Đã chốt",
      VOIDED: "Đã hủy",
      PENDING: "Đang chờ",
      WON: "Thắng",
      LOST: "Thua",
    },
  },
} as const

export type Messages = (typeof messages)[Locale]

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "vi" ? "vi" : "en"
}

export function unitLabel(value: number, locale: Locale = DEFAULT_LOCALE) {
  return `${value} ${messages[locale].common.unit}`
}

export function pickLabel(
  pick: BetPick | string | null | undefined,
  teams: { homeTeam: string; awayTeam: string },
  locale: Locale = DEFAULT_LOCALE,
) {
  if (pick === "HOME") return teams.homeTeam
  if (pick === "AWAY") return teams.awayTeam
  if (pick === "DRAW") return messages[locale].common.draw
  if (pick === "NO_BET") return messages[locale].common.noBet
  return pick ?? messages[locale].common.tbd
}

export function statusLabel(status: string, locale: Locale = DEFAULT_LOCALE) {
  return messages[locale].status[status as keyof Messages["status"]] ?? status
}

export function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}
