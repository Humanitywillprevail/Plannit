"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generatePendingNarratives } from "@/lib/actions/portfolio";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function GeneratePortfolioForm({ pendingCount }: { pendingCount: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="mb-6">
      <form
        action={() => startTransition(async () => { await generatePendingNarratives(); })}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-ink-secondary">
          아직 이야기로 만들지 않은 기록이 {pendingCount}개 있어요.
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          <Sparkles className="size-3.5" />
          {pending ? "만드는 중..." : "포트폴리오 만들기"}
        </Button>
      </form>
    </Card>
  );
}
