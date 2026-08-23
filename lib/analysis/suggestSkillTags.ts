import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { COMPETENCY_DICTIONARY } from "./keywordDictionary";

const SKILL_TAG_NAMES = COMPETENCY_DICTIONARY.map((c) => c.name) as [
  string,
  ...string[],
];

const SUGGEST_SCHEMA = z.object({
  tags: z.array(z.enum(SKILL_TAG_NAMES)).max(3),
});

function buildPrompt(content: string): string {
  const tagList = COMPETENCY_DICTIONARY.map((c) => `- ${c.name}`).join("\n");

  return `아래는 한 대학생이 작성한 활동 기록이다. 이 기록을 정리하는 걸 돕기 위해, 아래 태그 목록 중 이 기록과 관련 있어 보이는 태그를 2~3개 골라라.

태그 목록:
${tagList}

기록:
${content}

규칙:
- 이건 평가가 아니라 정리를 돕는 것이다. "역량이 부족하다/뛰어나다" 같은 판단적 표현은 쓰지 말 것.
- 명확히 관련 있어 보이는 태그만 고르고, 억지로 개수를 채우지 말 것 (0개도 가능).
- 목록에 없는 태그를 만들어내지 말 것.`;
}

// 정리 보조용 태그 추천. 판단/평가가 아니라 "이 내용이면 이 태그들이 관련 있어
// 보인다"는 가벼운 제안만 하고, 최종 선택은 항상 사용자가 한다.
export async function suggestSkillTags(content: string): Promise<string[]> {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const { output } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.object({ schema: SUGGEST_SCHEMA }),
    prompt: buildPrompt(trimmed),
  });

  return output.tags;
}
