import { COMPETENCY_DICTIONARY } from "./keywordDictionary";

export type CompetencyAnalysisResult = {
  competencyKey: string;
  score: number;
  matchedKeywords: string[];
  evidence: string | null;
};

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function extractSnippet(text: string, keyword: string, radius = 30): string {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) return text.trim().slice(0, 80);
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + keyword.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

// 규칙 기반(키워드 매칭) 역량 분석. 과목에 달린 여러 Record(과제/시험 등)의
// 텍스트를 합쳐서 역량 사전과 대조한다. 나중에 LLM 기반으로 교체하더라도
// 이 함수의 인터페이스(CompetencyAnalysisResult[])만 유지하면 호출부는 그대로 둘 수 있다.
export function analyzeCourseCompetencies(
  records: { content: string }[]
): CompetencyAnalysisResult[] {
  const results: CompetencyAnalysisResult[] = [];

  for (const competency of COMPETENCY_DICTIONARY) {
    let score = 0;
    const matchedKeywords = new Set<string>();
    let evidence: string | null = null;

    for (const record of records) {
      const text = record.content.toLowerCase();
      for (const keyword of competency.keywords) {
        const count = countOccurrences(text, keyword.toLowerCase());
        if (count > 0) {
          score += count;
          matchedKeywords.add(keyword);
          if (!evidence) {
            evidence = extractSnippet(record.content, keyword);
          }
        }
      }
    }

    if (score > 0) {
      results.push({
        competencyKey: competency.key,
        score,
        matchedKeywords: Array.from(matchedKeywords),
        evidence,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
