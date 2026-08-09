"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

const CUSTOM_VALUE = "__custom__";

export default function RecordTypeField({
  options,
}: {
  options: { value: string; label: string }[];
}) {
  const [isCustom, setIsCustom] = useState(false);

  if (isCustom) {
    return (
      <div className="flex items-center gap-2">
        <input
          name="type"
          required
          autoFocus
          placeholder="유형 입력 (예: 발표, 팀플, 실습)"
          className="w-40 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsCustom(false)}
        >
          목록에서 선택
        </Button>
      </div>
    );
  }

  return (
    <select
      name="type"
      defaultValue={options[0]?.value}
      onChange={(e) => {
        if (e.target.value === CUSTOM_VALUE) setIsCustom(true);
      }}
      className="w-32 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
    >
      {options.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      <option value={CUSTOM_VALUE}>직접 입력</option>
    </select>
  );
}
