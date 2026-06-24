import clsx from "clsx"

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "status-badge",
        status === "OPEN" || status === "SCHEDULED" || status === "WON"
          ? "status-bettable"
          : status === "LIVE" || status === "COMPLETED" || status === "PENDING"
            ? "status-support"
            : status === "SETTLED" || status === "LOCKED"
              ? "status-settled"
              : status === "VOIDED" || status === "LOST"
                ? "status-danger"
                : "status-neutral",
      )}
    >
      {status}
    </span>
  )
}
