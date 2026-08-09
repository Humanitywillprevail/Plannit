import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && (
        <div className="flex size-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted dark:bg-white/[0.06]">
          {icon}
        </div>
      )}
      <p className="text-sm text-ink-secondary">{message}</p>
      {action}
    </div>
  );
}
