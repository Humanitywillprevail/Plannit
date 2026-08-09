import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { deleteCourse } from "@/lib/actions/courses";
import DeleteForm from "@/components/DeleteForm";
import GradeBadge from "@/components/ui/GradeBadge";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import QuickAddCourse from "@/components/QuickAddCourse";
import { computeGpa, formatGpa } from "@/lib/gpa";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function SemesterDetailPage({
  params,
}: {
  params: Promise<{ semesterId: string }>;
}) {
  const { semesterId } = await params;
  const id = Number(semesterId);
  const userId = await requireUserId();

  const semester = await prisma.semester.findFirst({
    where: { id, userId },
    include: {
      courses: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!semester) notFound();

  const gpa = computeGpa(semester.courses);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title={semester.name}
        backHref="/semesters"
        backLabel="학기 리스트"
        action={
          <span
            className={`text-sm font-semibold tabular-nums ${gpa === null ? "text-ink-muted" : "text-accent"}`}
          >
            평균 {formatGpa(gpa)}
          </span>
        }
      />

      <div className="mb-4">
        <QuickAddCourse semesterId={semester.id} />
      </div>

      {semester.courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          message="아직 추가된 과목이 없습니다."
        />
      ) : (
        <ul className="space-y-2">
          {semester.courses.map((course) => (
            <li key={course.id}>
              <Card
                padded={false}
                className="flex items-center justify-between px-4 py-3.5 transition-colors hover:border-line-strong"
              >
                <Link
                  href={`/courses/${course.id}`}
                  className="flex flex-1 items-center gap-3 py-0.5"
                >
                  <span className="font-medium">{course.name}</span>
                  <span className="text-sm text-ink-secondary">
                    {course.credit}학점
                  </span>
                  <GradeBadge grade={course.grade} className="ml-auto" />
                </Link>
                <DeleteForm
                  action={deleteCourse}
                  hiddenFields={{ id: course.id }}
                  confirmMessage={`"${course.name}" 과목을 삭제할까요? 기록도 함께 삭제됩니다.`}
                  className="ml-3 shrink-0 rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger/10"
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
