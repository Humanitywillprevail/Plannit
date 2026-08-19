import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { buildCompetencyReport } from "@/lib/analysis/report";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function ReportPage() {
  const userId = await requireUserId();

  const [rows, totalCourses] = await Promise.all([
    prisma.courseCompetency.findMany({
      where: { course: { userId } },
      include: {
        competency: { select: { key: true, name: true, category: true } },
        course: { select: { name: true } },
      },
    }),
    prisma.course.count({ where: { userId } }),
  ]);

  const report = buildCompetencyReport(rows, {
    scopeLabel: "지금까지의 전체 기록",
    totalCourses,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="강점 리포트"
        backHref="/semesters"
        backLabel="학기 리스트"
      />

      <Card className="mb-6">
        <p className="leading-relaxed text-ink-secondary">
          {report.summaryParagraph}
        </p>
      </Card>

      {report.items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          message="과목 상세 페이지에서 과제·시험 내용을 기록하면 이 자리에 강점 분석이 채워져요."
        />
      ) : (
        <ul className="space-y-3">
          {report.detailParagraphs.map((d) => {
            const item = report.items.find((i) => i.key === d.key)!;
            return (
              <Card as="li" key={d.key}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{item.name}</h2>
                  <Badge>{item.category}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {d.paragraph}
                </p>
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
