"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createCourse } from "@/lib/actions/courses";
import { GRADE_OPTIONS } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function QuickAddCourse({ semesterId }: { semesterId: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong py-3.5 text-sm font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="size-4" />
        새 과목 추가
      </button>
    );
  }

  return (
    <Card>
      <form
        action={(formData) => {
          startTransition(async () => {
            await createCourse(formData);
            setOpen(false);
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="semesterId" value={semesterId} />
        <input
          name="name"
          required
          autoFocus
          placeholder="과목명"
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
        />
        <input
          name="credit"
          type="number"
          min={0}
          max={6}
          defaultValue={3}
          required
          aria-label="이수 학점"
          className="w-16 rounded-lg border border-line bg-transparent px-2 py-1.5 outline-none focus:border-accent"
        />
        <select
          name="grade"
          defaultValue=""
          className="rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
        >
          <option value="">성적 미입력</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          추가
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </form>
    </Card>
  );
}
