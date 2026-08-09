"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createSemester } from "@/lib/actions/semesters";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function QuickAddSemester() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong py-3.5 text-sm font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="size-4" />
        새 학기 추가
      </button>
    );
  }

  return (
    <Card>
      <form
        action={(formData) => {
          startTransition(async () => {
            await createSemester(formData);
            setOpen(false);
          });
        }}
        className="flex items-center gap-2"
      >
        <input
          name="name"
          required
          autoFocus
          placeholder="예: 2026-1학기"
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
        />
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
