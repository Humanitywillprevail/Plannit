import { COMPETENCY_DICTIONARY } from "./keywordDictionary";
import type { JobRoleCompetencyRequirement } from "./analyzeJobRole";

export type GapItem = {
  key: string;
  name: string;
  category: string;
  importance: number;
  currentStrength: number;
  message: string;
};

export type GapReport = {
  jobRole: string;
  items: GapItem[];
  summaryParagraph: string;
};

export type CurrentCompetencyRow = {
  score: number;
  competency: { key: string; name: string; category: string | null };
  course: { id: number };
};

function joinKoreanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}, ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} 그리고 ${items[items.length - 1]}`;
}

function buildGapMessage(name: string, currentStrength: number): string {
  if (currentStrength === 0) {
    return `${name} 관련 경험이 아직 기록에 없어요. 이 역량이 이 직무에서 중요하게 여겨지는 만큼, 관련 활동을 기록해보면 좋아요.`;
  }
  return `${name} 역량이 기록에 드러나긴 하지만, 이 직무가 요구하는 수준에는 아직 못 미쳐요. 관련 경험을 조금 더 쌓아보면 좋아요.`;
}

// CourseCompetency의 원점수(과목당 1~5)를 그대로 합산하면 과목 수가 많은
// 사용자일수록 무조건 유리해진다. "그 역량이 등장했을 때 평균적으로 얼마나
// 강하게 나타나는가"로 정규화해서, LLM이 매기는 직무 요구도(1~5)와 같은
// 척도로 비교할 수 있게 만든다. 한 번도 안 나온 역량은 0.
function computeCurrentStrength(
  currentRows: CurrentCompetencyRow[]
): Map<string, number> {
  const totals = new Map<string, { sum: number; courseIds: Set<number> }>();

  for (const row of currentRows) {
    const key = row.competency.key;
    const existing = totals.get(key);
    if (existing) {
      existing.sum += row.score;
      existing.courseIds.add(row.course.id);
    } else {
      totals.set(key, { sum: row.score, courseIds: new Set([row.course.id]) });
    }
  }

  const strength = new Map<string, number>();
  for (const [key, { sum, courseIds }] of totals) {
    strength.set(key, sum / courseIds.size);
  }
  return strength;
}

const MIN_IMPORTANCE_TO_FLAG = 3;
const MAX_GAP_ITEMS = 5;

export function buildGapReport(
  currentRows: CurrentCompetencyRow[],
  requirements: JobRoleCompetencyRequirement[],
  jobRole: string
): GapReport {
  const currentStrength = computeCurrentStrength(currentRows);
  const dictionaryByKey = new Map(
    COMPETENCY_DICTIONARY.map((c) => [c.key, c])
  );

  const candidates = requirements
    .map((req) => {
      const dict = dictionaryByKey.get(req.competencyKey);
      if (!dict) return null;
      const strength = currentStrength.get(req.competencyKey) ?? 0;
      return {
        key: req.competencyKey,
        name: dict.name,
        category: dict.category ?? "기타",
        importance: req.importance,
        currentStrength: strength,
        gap: req.importance - strength,
      };
    })
    .filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.gap > 0 && c.importance >= MIN_IMPORTANCE_TO_FLAG
    )
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_GAP_ITEMS);

  const items: GapItem[] = candidates.map((c) => ({
    key: c.key,
    name: c.name,
    category: c.category,
    importance: c.importance,
    currentStrength: c.currentStrength,
    message: buildGapMessage(c.name, c.currentStrength),
  }));

  const summaryParagraph =
    items.length === 0
      ? `${jobRole} 직무가 요구하는 역량을 지금까지의 기록만으로도 고르게 갖추고 있어요.`
      : `${jobRole} 직무와 비교했을 때, ${joinKoreanList(
          items.slice(0, 3).map((i) => i.name)
        )} 관련 경험이 상대적으로 부족해요. 아래 내용을 참고해서 관련 기록을 쌓아보세요.`;

  return { jobRole, items, summaryParagraph };
}
