import type { ElementType, ReactNode } from "react";

export default function Card({
  children,
  className = "",
  padded = true,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: ElementType;
}) {
  return (
    <Component
      className={`rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.05] ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </Component>
  );
}
