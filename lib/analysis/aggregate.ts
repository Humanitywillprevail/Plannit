export type CompetencySummary = {
  key: string;
  name: string;
  category: string;
  totalScore: number;
  courseCount: number;
};

type CourseCompetencyRow = {
  score: number;
  competency: { key: string; name: string; category: string | null };
};

// CourseCompetency 행들을 역량(key) 기준으로 합산한다.
// 학기별 대시보드는 해당 학기 과목들의 행만 넘기고, 누적 대시보드는 전체 행을 넘기면 된다.
export function aggregateCompetencies(
  rows: CourseCompetencyRow[]
): CompetencySummary[] {
  const map = new Map<string, CompetencySummary>();

  for (const row of rows) {
    const key = row.competency.key;
    const existing = map.get(key);
    if (existing) {
      existing.totalScore += row.score;
      existing.courseCount += 1;
    } else {
      map.set(key, {
        key,
        name: row.competency.name,
        category: row.competency.category ?? "기타",
        totalScore: row.score,
        courseCount: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalScore - a.totalScore);
}
