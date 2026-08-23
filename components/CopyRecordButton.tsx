"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CopyRecordButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경 — 조용히 무시
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="size-3.5" />
          복사됐어요
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          복사
        </>
      )}
    </Button>
  );
}
