import { gradeTier } from "@/lib/types";

const TIER_STYLES: Record<string, string> = {
  A: "bg-grade-a/12 text-grade-a",
  B: "bg-grade-b/12 text-grade-b",
  C: "bg-grade-c/12 text-grade-c",
  D: "bg-grade-d/12 text-grade-d",
  F: "bg-grade-f/12 text-grade-f",
};

export default function GradeBadge({
  grade,
  className = "",
}: {
  grade: string | null;
  className?: string;
}) {
  if (!grade) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-ink-muted ${className}`}
      >
        미입력
      </span>
    );
  }

  const tier = gradeTier(grade);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${TIER_STYLES[tier]} ${className}`}
    >
      {grade}
    </span>
  );
}
