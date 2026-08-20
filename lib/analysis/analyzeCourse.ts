import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { COMPETENCY_DICTIONARY } from "./keywordDictionary";

export type CompetencyAnalysisResult = {
  competencyKey: string;
  score: number;
  matchedKeywords: string[];
  evidence: string | null;
};

export const COMPETENCY_KEYS = COMPETENCY_DICTIONARY.map((c) => c.key) as [
  string,
  ...string[],
];

const ANALYSIS_SCHEMA = z.object({
  results: z.array(
    z.object({
      competencyKey: z.enum(COMPETENCY_KEYS),
      score: z.number().int().min(1).max(5),
      evidencePhrases: z.array(z.string()).max(4),
      evidence: z.string().nullable(),
    })
  ),
});

function buildPrompt(records: { content: string }[]): string {
  const dictionaryList = COMPETENCY_DICTIONARY.map(
    (c) => `- ${c.key} (${c.name}, ${c.category})`
  ).join("\n");

  const recordsText = records
    .map((r, i) => `[기록 ${i + 1}]\n${r.content}`)
    .join("\n\n");

  return `아래는 한 대학생이 어떤 과목에서 수행한 과제·시험 등의 기록이다. 이 기록을 읽고 실제로 드러나는 역량을 아래 목록에서만 골라 평가하라.

역량 목록:
${dictionaryList}

기록:
${recordsText}

규칙:
- 특정 단어가 등장했다고 기계적으로 매칭하지 말고, 내용과 사고 과정을 이해해서 판단할 것. (예: "통계"라는 단어가 나왔다고 해서 무조건 수리/통계 능력으로 보지 말고, 실제로 통계적 방법론을 다뤘는지 봐야 함)
- 그 기록에서 명확히 드러나지 않는 역량은 결과에서 제외할 것.
- score는 1~5 사이 정수로, 그 역량이 얼마나 뚜렷하게 드러나는지를 나타냄.
- evidencePhrases는 판단 근거가 되는 기록 속 짧은 표현이나 구절 (최대 4개).
- evidence는 왜 이 역량으로 판단했는지에 대한 한 문장 설명.`;
}

// LLM 기반 역량 분석. 과목에 달린 여러 Record(과제/시험 등)의 텍스트를 합쳐
// 실제 내용을 이해시켜 역량을 판단한다 (단순 키워드 매칭이 아님 — 예: "무역 통계"처럼
// 키워드가 우연히 포함된 경우를 걸러내기 위함). 호출부는 이전 규칙 기반 버전과
// 동일한 인터페이스(CompetencyAnalysisResult[])를 그대로 사용한다.
export async function analyzeCourseCompetencies(
  records: { content: string }[]
): Promise<CompetencyAnalysisResult[]> {
  if (records.length === 0) return [];

  const { output } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.object({ schema: ANALYSIS_SCHEMA }),
    prompt: buildPrompt(records),
  });

  return output.results
    .map((r) => ({
      competencyKey: r.competencyKey,
      score: r.score,
      matchedKeywords: r.evidencePhrases,
      evidence: r.evidence,
    }))
    .sort((a, b) => b.score - a.score);
}
