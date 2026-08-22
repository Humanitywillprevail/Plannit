import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradeBadge from "@/components/ui/GradeBadge";
import Button from "@/components/ui/Button";
import QuickAddSemester from "@/components/QuickAddSemester";
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";
import { computeGpa, formatGpa } from "@/lib/gpa";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function SemestersPage() {
  const userId = await requireUserId();

  const semesters = await prisma.semester.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      courses: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, grade: true, credit: true },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
        <div className="flex items-center gap-2">
          <Link href="/report">
            <Button variant="secondary" size="sm">
              <Sparkles className="size-3.5" />
              강점 리포트
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="secondary" size="sm">
              <BookOpen className="size-3.5" />
              포트폴리오
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <QuickAddSemester />
      </div>

      {semesters.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-5" />}
          message="아직 추가된 학기가 없어요. 위 버튼으로 첫 학기를 만들어보세요."
        />
      ) : (
        <ul className="space-y-3">
          {semesters.map((s) => {
            const gpa = computeGpa(s.courses);
            return (
            <li key={s.id}>
              <Link href={`/semesters/${s.id}`}>
                <Card className="transition-colors hover:border-line-strong">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{s.name}</p>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${gpa === null ? "text-ink-muted" : "text-accent"}`}
                    >
                      평균 {formatGpa(gpa)}
                    </span>
                  </div>
                  {s.courses.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      아직 등록된 과목이 없어요.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {s.courses.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate text-ink-secondary">
                            {c.name}
                          </span>
                          <GradeBadge grade={c.grade} className="shrink-0" />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
