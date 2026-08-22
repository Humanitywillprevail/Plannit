import Link from "next/link";
import { Target } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { createPortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function NewPortfolioPage() {
  const userId = await requireUserId();

  // 콜드 스타트 게이트: /portfolio 목록 페이지와 동일한 기준(역량 분석된 과목
  // 2개 미만이면 아예 시작을 막는다). /portfolio/new로 직접 진입해도 우회되지
  // 않도록 create 플로우 진입점에도 동일하게 건다.
  const eligibleCourses = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  if (eligibleCourses.length < 2) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <PageHeader title="새 포트폴리오 만들기" backHref="/portfolio" backLabel="포트폴리오 목록" />
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

  const semesters = await buildPickerSemesters(userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader title="새 포트폴리오 만들기" backHref="/portfolio" backLabel="포트폴리오 목록" />

      {semesters.length === 0 ? (
        <EmptyState
          message="아직 포트폴리오에 담을 수 있는 활동이 없어요. 과목 상세 페이지에서 기록의 '포트폴리오용 상세 입력'을 채워주세요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                학기 리스트로 가기
              </Button>
            </Link>
          }
        />
      ) : (
        <PortfolioForm action={createPortfolio} semesters={semesters} submitLabel="만들기" />
      )}
    </main>
  );
}
