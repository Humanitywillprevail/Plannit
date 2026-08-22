import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export type RecordNarrative = {
  intro: string;
  background: string;
  process: string;
  outcome: string;
  growth: string;
  competency: string;
};

// 화면(app/portfolio/[id]/page.tsx)과 PDF(app/portfolio/[id]/pdf/route.tsx)가
// 공유하는 표시 순서 + 한글 라벨. 여기 한 곳에서만 정의한다.
export const NARRATIVE_SECTION_LABELS: { key: keyof RecordNarrative; label: string }[] = [
  { key: "intro", label: "소개" },
  { key: "background", label: "배경/목적" },
  { key: "process", label: "과정" },
  { key: "outcome", label: "결과물" },
  { key: "growth", label: "성장한 점" },
  { key: "competency", label: "나의 역량" },
];

const NARRATIVE_SCHEMA = z.object({
  intro: z.string(),
  background: z.string(),
  process: z.string(),
  outcome: z.string(),
  growth: z.string(),
  competency: z.string(),
});

export type NarrativeInput = {
  content: string;
  summary: string | null;
  background: string | null;
  process: string | null;
  outcome: string | null;
  growth: string | null;
  competencyNote: string | null;
};

function buildPrompt(input: NarrativeInput): string {
  const lines = [`진행한 일: ${input.content}`];
  if (input.summary) lines.push(`소개(한 줄 요약): ${input.summary}`);
  if (input.background) lines.push(`배경/목적: ${input.background}`);
  if (input.process) lines.push(`과정: ${input.process}`);
  if (input.outcome) lines.push(`결과물: ${input.outcome}`);
  if (input.growth) lines.push(`성장한 점: ${input.growth}`);
  if (input.competencyNote) lines.push(`나의 역량: ${input.competencyNote}`);

  return `아래는 한 대학생이 어떤 학업 활동에 대해 남긴 메모다. 이 메모를 재료로 삼아,
사람이 읽었을 때 자연스러운 하나의 이야기로 느껴지도록 7단계 구조의 자기소개용 포트폴리오
문단을 1인칭으로 작성하라. 메모에 없는 내용을 지어내지 말고, 메모에 있는 사실만 활용해서
문장을 다듬고 이어 붙여라.

메모:
${lines.join("\n")}

작성할 항목 (각 항목은 한 문단):
- intro: 이 활동을 한 줄로 소개
- background: 왜 이 활동을 하게 됐는지
- process: 어떤 행동을 했고 어떤 인사이트를 얻었는지
- outcome: 최종적으로 만들어낸 것
- growth: 이 경험으로 성장한 점
- competency: 느낀 점, 배운 점, 다짐`;
}

// 한 Record의 필드를 7단계 구조의 서사형 텍스트로 재구성한다.
// 실패 시 그대로 throw — 호출부(lib/actions/portfolio.ts)가 기록 단위로 catch한다.
export async function generateNarrative(input: NarrativeInput): Promise<RecordNarrative> {
  const { output } = await generateText({
    model: anthropic("claude-sonnet-5"),
    output: Output.object({ schema: NARRATIVE_SCHEMA }),
    prompt: buildPrompt(input),
  });

  return output;
}
