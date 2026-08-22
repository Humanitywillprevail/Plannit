"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { analyzePortfolio, type PortfolioFeedback } from "@/lib/actions/portfolios";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

function formatAnalyzedAt(date: Date | null): string {
  if (!date) return "아직 분석 전";
  return `마지막 분석: ${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

export default function PortfolioFeedbackPanel({
  portfolioId,
  feedback,
  analyzedAt,
}: {
  portfolioId: number;
  feedback: PortfolioFeedback | null;
  analyzedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzePortfolio(portfolioId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">{formatAnalyzedAt(analyzedAt)}</p>
        <Button size="sm" variant="secondary" disabled={pending} onClick={handleAnalyze}>
          {pending ? "분석 중..." : analyzedAt ? "다시 분석" : "분석하기"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {feedback && (
        <div className="space-y-4">
          <p className="leading-relaxed text-ink-secondary">{feedback.summaryParagraph}</p>

          {feedback.gaps.length > 0 && (
            <ul className="space-y-3">
              {feedback.gaps.map((item) => (
                <Card as="li" key={item.key} padded={false} className="p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge>{item.category}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-secondary">{item.message}</p>
                </Card>
              ))}
            </ul>
          )}

          {feedback.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">이런 활동을 추가해보세요</p>
              <ul className="space-y-2">
                {feedback.recommendations.map((rec) => (
                  <li
                    key={`${rec.courseId}-${rec.competencyKey}`}
                    className="flex items-center justify-between gap-3 text-sm text-ink-secondary"
                  >
                    <span>
                      <span className="font-medium text-foreground">{rec.courseName}</span>
                      {" — "}
                      {rec.competencyName} 관련 활동이 있어요
                    </span>
                    {rec.candidateRecordIds.length > 0 && (
                      <Link href={`/portfolio/${portfolioId}/edit?preselect=${rec.candidateRecordIds.join(",")}`}>
                        <Button variant="ghost" size="sm">
                          고르러 가기
                        </Button>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
