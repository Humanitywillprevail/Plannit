import type { ReactNode } from "react";

export default function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-ink-secondary dark:bg-white/[0.06] ${className}`}
    >
      {children}
    </span>
  );
}
