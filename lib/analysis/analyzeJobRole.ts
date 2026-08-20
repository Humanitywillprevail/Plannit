import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { COMPETENCY_DICTIONARY } from "./keywordDictionary";
import { COMPETENCY_KEYS } from "./analyzeCourse";

export type JobRoleCompetencyRequirement = {
  competencyKey: string;
  importance: number;
};

const REQUIREMENT_SCHEMA = z.object({
  requirements: z
    .array(
      z.object({
        competencyKey: z.enum(COMPETENCY_KEYS),
        importance: z.number().int().min(1).max(5),
      })
    )
    .length(COMPETENCY_DICTIONARY.length),
});

function buildPrompt(jobRole: string): string {
  const dictionaryList = COMPETENCY_DICTIONARY.map(
    (c) => `- ${c.key} (${c.name}, ${c.category})`
  ).join("\n");

  return `아래는 한 대학생이 입사를 목표로 하는 직무다. 이 직무에서 일반적으로
얼마나 중요하게 여겨지는 역량인지를, 아래 역량 목록 12개 각각에 대해 평가하라.

직무: ${jobRole}

역량 목록:
${dictionaryList}

규칙:
- 특정 회사나 채용 공고를 참고하지 말고, 이 직무가 일반적으로 요구하는 역량이
  무엇인지 일반적인 직무 지식을 바탕으로 판단할 것.
- importance는 1~5 사이 정수로, 그 역량이 이 직무에서 얼마나 중요한지를 나타냄.
  전혀 관련 없으면 1, 핵심 역량이면 5.
- 위 12개 역량 전부에 대해 각각 하나씩 평가할 것 (일부만 고르거나 생략하지 말 것).`;
}

// 직무명(자유 텍스트)에 대해 12개 고정 역량 각각의 중요도를 LLM으로 판단한다.
// 실제 채용 공고나 회사를 참고하지 않고 일반적인 직무 지식으로만 판단하며,
// 스키마에 자유 텍스트 필드가 없어 구체적 사실을 지어낼 수 있는 여지가 없다.
export async function analyzeJobRoleRequirements(
  jobRole: string
): Promise<JobRoleCompetencyRequirement[]> {
  const { output } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.object({ schema: REQUIREMENT_SCHEMA }),
    prompt: buildPrompt(jobRole),
  });

  return output.requirements;
}
