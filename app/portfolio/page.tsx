import Link from "next/link";
import { BookOpen, Target } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioListPage() {
  const userId = await requireUserId();

  // 콜드 스타트 게이트: 옛 /gap-analysis와 동일한 기준(역량 분석된 과목 2개
  // 미만이면 아예 시작을 막는다) — 근거가 거의 없는 상태에서 만든 포트폴리오는
  // 갭 분석 결과도 사실상 노이즈이기 때문.
  const eligibleCourses = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  if (eligibleCourses.length < 2) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <PageHeader title="포트폴리오" backHref="/semesters" backLabel="학기 리스트" />
        <EmptyState
          icon={<Target className="size-5" />}
          message="아직 분석할 기록이 부족해요. 과목을 2개 이상 등록하면 포트폴리오를 만들 수 있어요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                과목 추가하러 가기
              </Button>
            </Link>
          }
        />
      </main>
    );
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오"
        backHref="/semesters"
        backLabel="학기 리스트"
        action={
          <Link href="/portfolio/new">
            <Button size="sm">새 포트폴리오 만들기</Button>
          </Link>
        }
      />

      {portfolios.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          message="아직 만든 포트폴리오가 없어요. 목표 직무를 정하고 활동을 골라 첫 포트폴리오를 만들어보세요."
        />
      ) : (
        <ul className="space-y-3">
          {portfolios.map((p) => (
            <li key={p.id}>
              <Link href={`/portfolio/${p.id}`}>
                <Card className="transition-colors hover:border-line-strong">
                  <p className="text-lg font-semibold">{p.name}</p>
                  <p className="text-sm text-ink-secondary">{p.targetJobRole}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {p.analyzedAt
                      ? `마지막 분석: ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(p.analyzedAt)}`
                      : "아직 분석 전"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
