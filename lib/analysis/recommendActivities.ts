import type { GapItem } from "./gapReport";

export type RecommendationCandidateRow = {
  score: number;
  competency: { key: string };
  course: { id: number; name: string };
};

export type RecommendationItem = {
  courseId: number;
  courseName: string;
  competencyKey: string;
  competencyName: string;
  score: number;
  candidateRecordIds: number[];
};

const MAX_RECOMMENDATIONS = 3;
const MAX_GAPS_CONSIDERED = 2;
const MAX_PER_GAP = 2;

// 갭이 가장 큰 역량 1~2개에 대해, 아직 포트폴리오에 포함되지 않은 과목들 중
// 해당 역량 점수가 높은 과목을 추천한다. CourseCompetency 데이터만 사용하는
// 순수 계산 — 새 LLM 호출 없음. 매칭되는 과목이 없는 갭은 그냥 건너뛴다.
export function recommendActivities(
  gapItems: GapItem[],
  otherCourseRows: RecommendationCandidateRow[],
  eligibleRecordsByCourse: Map<number, number[]>
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  for (const gap of gapItems.slice(0, MAX_GAPS_CONSIDERED)) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;

    const matchingRows = otherCourseRows
      .filter((row) => row.competency.key === gap.key)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GAP);

    for (const row of matchingRows) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;
      recommendations.push({
        courseId: row.course.id,
        courseName: row.course.name,
        competencyKey: gap.key,
        competencyName: gap.name,
        score: row.score,
        candidateRecordIds: eligibleRecordsByCourse.get(row.course.id) ?? [],
      });
    }
  }

  return recommendations;
}
