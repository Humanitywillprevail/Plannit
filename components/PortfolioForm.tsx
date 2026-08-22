"use client";

import { useActionState } from "react";
import PortfolioRecordPicker, { type PickerSemester } from "@/components/PortfolioRecordPicker";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { PortfolioFormState } from "@/lib/actions/portfolios";

const INITIAL_STATE: PortfolioFormState = { status: "idle" };

export default function PortfolioForm({
  action,
  initialName = "",
  initialJobRole = "",
  hiddenFields = {},
  semesters,
  initialSelectedIds = [],
  submitLabel,
}: {
  action: (prevState: PortfolioFormState, formData: FormData) => Promise<PortfolioFormState>;
  initialName?: string;
  initialJobRole?: string;
  hiddenFields?: Record<string, string | number>;
  semesters: PickerSemester[];
  initialSelectedIds?: number[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <Card>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">이름</label>
            <input
              name="name"
              required
              defaultValue={initialName}
              placeholder="예: 백엔드 개발자용 포트폴리오"
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">목표 직무</label>
            <input
              name="targetJobRole"
              required
              defaultValue={initialJobRole}
              placeholder="예: 백엔드 개발자"
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
      </Card>

      <PortfolioRecordPicker semesters={semesters} initialSelectedIds={initialSelectedIds} />

      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
