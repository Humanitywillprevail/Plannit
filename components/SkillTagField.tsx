"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { suggestTagsForRecord } from "@/lib/actions/records";

export default function SkillTagField({
  presets,
  initialSelected = [],
}: {
  presets: string[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [customInput, setCustomInput] = useState("");
  const [aiSuggested, setAiSuggested] = useState<Set<string>>(new Set());
  const [suggesting, startSuggesting] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setSelected(initialSelected);
      setCustomInput("");
      setAiSuggested(new Set());
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initialSelected]);

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    // 사용자가 한 번이라도 직접 건드린 태그는 더 이상 "AI 추천" 표시를 두지 않는다 —
    // 손댄 순간부터는 사용자가 확인/결정한 일반 태그로 취급.
    setAiSuggested((prev) => {
      if (!prev.has(tag)) return prev;
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  }

  function handleSuggest() {
    const form = rootRef.current?.closest("form");
    const content = form?.querySelector<HTMLTextAreaElement>('[name="content"]')?.value ?? "";
    if (!content.trim()) return;

    startSuggesting(async () => {
      const tags = await suggestTagsForRecord(content);
      if (tags.length === 0) return;
      setSelected((prev) => Array.from(new Set([...prev, ...tags])));
      setAiSuggested((prev) => new Set([...prev, ...tags]));
    });
  }

  function addCustomTag() {
    const tag = customInput.trim();
    if (!tag || selected.includes(tag)) return;
    setSelected((prev) => [...prev, tag]);
    setCustomInput("");
  }

  const customTags = selected.filter((t) => !presets.includes(t));

  return (
    <div ref={rootRef}>
      <div className="mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={suggesting}
          onClick={handleSuggest}
        >
          <Sparkles className="size-3.5" />
          {suggesting ? "추천 중..." : "AI로 태그 추천받기"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((tag) => {
          const active = selected.includes(tag);
          const ai = active && aiSuggested.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                ai
                  ? "border-accent border-dashed bg-accent/20 text-accent"
                  : active
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              {ai ? "✨ " : ""}
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
