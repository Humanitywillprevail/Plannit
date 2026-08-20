import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";
import { NARRATIVE_SECTION_LABELS, type RecordNarrative } from "@/lib/analysis/generateNarrative";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import GeneratePortfolioForm from "@/components/GeneratePortfolioForm";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioPage() {
  const userId = await requireUserId();

  const records = await prisma.record.findMany({
    where: portfolioEligibleWhere(userId),
    orderBy: { createdAt: "desc" },
    include: { course: { select: { name: true } } },
  });

  const generated = records.filter((r) => r.narrative !== null);
  const pending = records.filter((r) => r.narrative === null);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오"
        backHref="/semesters"
        backLabel="학기 리스트"
        action={
          generated.length > 0 ? (
            <a href="/portfolio/pdf">
              <Button variant="secondary" size="sm">
                전체 PDF 다운로드
              </Button>
            </a>
          ) : undefined
        }
      />

      {pending.length > 0 && <GeneratePortfolioForm pendingCount={pending.length} />}

      {generated.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          message="과목 상세 페이지에서 기록을 작성할 때 '포트폴리오용 상세 입력'을 채우면 이 자리에 포트폴리오가 채워져요."
        />
      ) : generated.length > 0 ? (
        <ul className="space-y-4">
          {generated.map((r) => {
            const narrative = r.narrative as unknown as RecordNarrative;
            return (
              <Card as="li" key={r.id}>
                <h2 className="mb-3 font-semibold">{r.course.name}</h2>
                <div className="space-y-3">
                  {NARRATIVE_SECTION_LABELS.map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-xs text-ink-secondary">{label}</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {narrative[key]}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
