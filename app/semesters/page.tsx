import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradeBadge from "@/components/ui/GradeBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CopyRecordButton from "@/components/CopyRecordButton";
import QuickAddSemester from "@/components/QuickAddSemester";
import { GraduationCap, Tags } from "lucide-react";
import { computeGpa, formatGpa } from "@/lib/gpa";
import { SKILL_TAG_PRESETS } from "@/lib/types";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function SemestersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tag?: string }>;
}) {
  const userId = await requireUserId();
  const { view: viewParam, tag } = await searchParams;
  const view = viewParam === "skill" ? "skill" : "semester";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
      </div>

      <div className="mb-6 flex gap-2">
        <Link href="/semesters">
          <Button variant={view === "semester" ? "secondary" : "ghost"} size="sm">
            학기별 보기
          </Button>
        </Link>
        <Link href="/semesters?view=skill">
          <Button variant={view === "skill" ? "secondary" : "ghost"} size="sm">
            역량별 보기
          </Button>
        </Link>
      </div>

      {view === "skill" ? (
        <SkillView userId={userId} tag={tag} />
      ) : (
        <SemesterView userId={userId} />
      )}
    </main>
  );
}

async function SemesterView({ userId }: { userId: string }) {
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
    <>
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
    </>
  );
}

async function SkillView({ userId, tag }: { userId: string; tag?: string }) {
  // 태그 목록과 태그별 기록 모두 같은 데이터에서 뽑아낼 수 있으므로,
  // DB 왕복을 한 번으로 줄이기 위해 여기서 한 번만 조회한다.
  const records = await prisma.record.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { course: { include: { semester: true } } },
  });

  const customTags = Array.from(
    new Set(
      records.flatMap((r) => r.skillTags).filter((t) => !SKILL_TAG_PRESETS.includes(t))
    )
  ).sort();
  const allTags = [...SKILL_TAG_PRESETS, ...customTags];

  const taggedRecords = tag ? records.filter((r) => r.skillTags.includes(tag)) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t) => (
          <Link key={t} href={`/semesters?view=skill&tag=${encodeURIComponent(t)}`}>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                tag === t
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              {t}
            </span>
          </Link>
        ))}
      </div>

      {!tag && (
        <p className="text-sm text-ink-muted">
          태그를 선택하면 관련 기록을 모아볼 수 있어요.
        </p>
      )}

      {tag &&
        (taggedRecords.length === 0 ? (
          <EmptyState
            icon={<Tags className="size-5" />}
            message={`"${tag}" 태그가 달린 기록이 아직 없어요.`}
          />
        ) : (
          <ul className="space-y-2">
            {taggedRecords.map((r) => (
              <Card as="li" key={r.id} padded>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-xs text-ink-muted">
                      {r.course.semester.name} · {r.course.name}
                    </p>
                    <p className="text-sm">{r.content}</p>
                  </div>
                  <CopyRecordButton content={r.content} />
                </div>
                {r.skillTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.skillTags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </ul>
        ))}
    </div>
  );
}
