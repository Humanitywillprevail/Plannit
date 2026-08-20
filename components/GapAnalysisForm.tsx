"use client";

import { useActionState } from "react";
import { analyzeJobGap, type GapAnalysisState } from "@/lib/actions/gapAnalysis";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const INITIAL_STATE: GapAnalysisState = { status: "idle" };

export default function GapAnalysisForm() {
  const [state, formAction, pending] = useActionState(
    analyzeJobGap,
    INITIAL_STATE
  );

  return (
    <div>
      <Card className="mb-6">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input
            name="jobRole"
            required
            placeholder="예: 백엔드 개발자"
            className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "분석 중..." : "갭 분석하기"}
          </Button>
        </form>
      </Card>

      {state.status === "error" && (
        <p className="mb-6 text-sm text-danger">{state.message}</p>
      )}

      {state.status === "result" && (
        <>
          <Card className="mb-6">
            <p className="leading-relaxed text-ink-secondary">
              {state.report.summaryParagraph}
            </p>
          </Card>

          {state.report.items.length > 0 && (
            <ul className="space-y-3">
              {state.report.items.map((item) => (
                <Card as="li" key={item.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="font-semibold">{item.name}</h2>
                    <Badge>{item.category}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {item.message}
                  </p>
                </Card>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
