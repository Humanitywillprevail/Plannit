import type { ComponentProps } from "react";

const VARIANTS = {
  // orange fill + indigo ink is Plannit's signature pairing (verified 4.9:1 contrast) —
  // deliberately not white-on-orange, which reads as a generic dashboard CTA.
  primary: "bg-accent text-accent-ink font-semibold hover:bg-accent-hover shadow-sm",
  secondary:
    "border border-line bg-transparent text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
  ghost:
    "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
  danger: "text-danger hover:bg-danger/10",
} as const;

const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
  lg: "px-5 py-2.5 text-base",
} as const;

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
