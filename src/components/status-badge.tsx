"use client"

import clsx from "clsx"
import { useI18n } from "@/components/language-provider"
import { statusLabel } from "@/lib/i18n"

export function StatusBadge({ status }: { status: string }) {
  const { locale } = useI18n()

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
      {statusLabel(status, locale)}
    </span>
  )
}
