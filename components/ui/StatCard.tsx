import type { ReactNode } from "react";
import Card from "./Card";

export default function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3.5">
      {icon && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-ink-secondary">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}
