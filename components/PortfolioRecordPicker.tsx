"use client";

import { useTransition } from "react";
import { generatePendingNarratives } from "@/lib/actions/portfolio";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type PickerRecord = { id: number; content: string; hasNarrative: boolean };
export type PickerCourse = { id: number; name: string; records: PickerRecord[] };
export type PickerSemester = { id: number; name: string; courses: PickerCourse[] };

// name="recordIds"인 체크박스만 렌더링한다 — 실제 <form>과 submit 버튼은
// 이 컴포넌트를 감싸는 부모(PortfolioForm)가 갖고 있다. narrative 생성
// 버튼은 별도 <form> 없이 서버 액션을 직접 호출한다 (같은 폼 안에 중첩된
// <form>을 넣을 수 없어서).
export default function PortfolioRecordPicker({
  semesters,
  initialSelectedIds = [],
}: {
  semesters: PickerSemester[];
  initialSelectedIds?: number[];
}) {
  const [pending, startTransition] = useTransition();
  const selected = new Set(initialSelectedIds);

  return (
    <div className="space-y-4">
      {semesters.map((semester) => (
        <div key={semester.id}>
          <p className="mb-2 text-sm font-semibold text-ink-secondary">{semester.name}</p>
          <div className="space-y-3">
            {semester.courses.map((course) => (
              <Card key={course.id}>
                <p className="mb-2 font-semibold">{course.name}</p>
                <ul className="space-y-2">
                  {course.records.map((record) => (
                    <li key={record.id} className="flex items-start justify-between gap-3">
                      <label className="flex flex-1 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="recordIds"
                          value={record.id}
                          defaultChecked={selected.has(record.id)}
                          className="mt-0.5"
                        />
                        <span className="line-clamp-2">{record.content}</span>
                      </label>
                      {record.hasNarrative ? (
                        <Badge>작성됨</Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await generatePendingNarratives([record.id]);
                            })
                          }
                        >
                          {pending ? "생성 중..." : "생성 필요"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
