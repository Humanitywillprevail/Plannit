"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function SkillTagField({
  presets,
  initialSelected = [],
}: {
  presets: string[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [customInput, setCustomInput] = useState("");

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const tag = customInput.trim();
    if (!tag || selected.includes(tag)) return;
    setSelected((prev) => [...prev, tag]);
    setCustomInput("");
  }

  const customTags = selected.filter((t) => !presets.includes(t));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              {tag}
            </button>
          );
        })}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-accent-ink"
          >
            {tag} ✕
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="직접 추가"
          className="w-32 rounded-lg border border-line bg-transparent px-3 py-1 text-sm outline-none focus:border-accent"
        />
        <Button type="button" variant="ghost" size="sm" onClick={addCustomTag}>
          추가
        </Button>
      </div>

      {selected.map((tag) => (
        <input key={tag} type="hidden" name="skillTags" value={tag} />
      ))}
    </div>
  );
}
