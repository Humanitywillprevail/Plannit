import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { addRecord, deleteRecord } from "@/lib/actions/records";
import { updateCourse } from "@/lib/actions/courses";
import { RECORD_TYPE_OPTIONS, recordTypeLabel, GRADE_OPTIONS } from "@/lib/types";
import DeleteForm from "@/components/DeleteForm";
import AttachmentList from "@/components/AttachmentList";
import RecordTypeField from "@/components/RecordTypeField";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import GradeBadge from "@/components/ui/GradeBadge";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const id = Number(courseId);
  const userId = await requireUserId();

  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: {
      semester: true,
      records: {
        orderBy: { createdAt: "desc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!course) notFound();

  const knownTypes = new Set<string>(RECORD_TYPE_OPTIONS.map((t) => t.value));
  const customTypes = Array.from(
    new Set(course.records.map((r) => r.type).filter((t) => !knownTypes.has(t)))
  );
  const typeOptions = [
    ...RECORD_TYPE_OPTIONS,
    ...customTypes.map((t) => ({ value: t, label: recordTypeLabel(t) })),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title={course.name}
        subtitle={`${course.semester.name} · ${course.credit}학점`}
        backHref={`/semesters/${course.semesterId}`}
        backLabel={course.semester.name}
        action={<GradeBadge grade={course.grade} className="text-sm" />}
      />

      <section className="mb-8">
        <Card className="flex flex-wrap items-end gap-3">
          <form action={updateCourse} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={course.id} />
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                이수 학점
              </label>
              <input
                name="credit"
                type="number"
                min={0}
                max={6}
                defaultValue={course.credit}
                className="w-20 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                성적
              </label>
              <select
                name="grade"
                defaultValue={course.grade ?? ""}
                className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              >
                <option value="">미입력</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              저장
            </Button>
          </form>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">기록 추가</h2>
        <Card>
          <form action={addRecord} className="space-y-3">
            <input type="hidden" name="courseId" value={course.id} />
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                유형
              </label>
              <RecordTypeField options={typeOptions} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                내용
              </label>
              <textarea
                name="content"
                required
                rows={4}
                placeholder="이 과목에서 한 일을 자유롭게 적어보세요"
                className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                첨부파일{" "}
                <span className="text-ink-muted">
                  (포트폴리오용 이미지, PDF 등 · 최대 5개, 파일당 10MB)
                </span>
              </label>
              <input
                name="files"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.zip"
                className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
              />
            </div>
            <Button type="submit">기록 추가</Button>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">기록된 내용</h2>
        {course.records.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            message="아직 입력된 기록이 없습니다."
          />
        ) : (
          <ul className="space-y-2">
            {course.records.map((r) => (
              <Card key={r.id} as="li" padded>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <p>
                    <Badge className="mr-2 align-middle">
                      {recordTypeLabel(r.type)}
                    </Badge>
                    {r.content}
                  </p>
                  <DeleteForm
                    action={deleteRecord}
                    hiddenFields={{ id: r.id }}
                    confirmMessage="이 기록을 삭제할까요? 첨부파일도 함께 삭제됩니다."
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  />
                </div>
                <AttachmentList attachments={r.attachments} />
              </Card>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
