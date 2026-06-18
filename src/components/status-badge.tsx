import clsx from "clsx"

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2 py-1 text-xs font-black",
        status === "OPEN" || status === "SCHEDULED"
          ? "bg-emerald-100 text-emerald-800"
          : status === "SETTLED"
            ? "bg-blue-100 text-blue-800"
            : status === "VOIDED"
              ? "bg-red-100 text-red-800"
              : "bg-stone-200 text-stone-800",
      )}
    >
      {status}
    </span>
  )
}
