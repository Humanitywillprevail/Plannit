import { Star } from "lucide-react";

export default function StarRating({
  rating,
  className = "",
  title,
}: {
  rating: number;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} title={title}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`size-3.5 ${
            n <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-ink-muted"
          }`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}
