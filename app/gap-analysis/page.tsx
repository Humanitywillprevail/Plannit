import Link from "next/link";
import { Target } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import GapAnalysisForm from "@/components/GapAnalysisForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function GapAnalysisPage() {
  const userId = await requireUserId();

  const eligibleCourses = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="직무 갭 분석"
        backHref="/semesters"
        backLabel="학기 리스트"
      />

      {eligibleCourses.length < 2 ? (
        <EmptyState
          icon={<Target className="size-5" />}
          message="아직 분석할 기록이 부족해요. 과목을 2개 이상 등록하면 갭분석을 이용할 수 있어요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                과목 추가하러 가기
              </Button>
            </Link>
          }
        />
      ) : (
        <GapAnalysisForm />
      )}
    </main>
  );
}
