// 4.5점 만점 학점 환산표. C 밑으로는 명세에 없어 동일한 0.5 간격 패턴을 이어간다.
export const GRADE_POINTS: Record<string, number> = {
  "A+": 4.5,
  A0: 4.0,
  "B+": 3.5,
  B0: 3.0,
  "C+": 2.5,
  C0: 2.0,
  "D+": 1.5,
  D0: 1.0,
  F: 0.0,
};

export function gradePoint(grade: string | null): number | null {
  if (!grade) return null;
  return GRADE_POINTS[grade] ?? null;
}

// 학점 가중평균 = Σ(성적 점수 × 이수 학점) / Σ(이수 학점).
// 성적이 없는(미입력) 과목은 분모/분자 어느 쪽에도 넣지 않는다 — 아직 평가되지 않은 과목이 평균을 끌어내리면 안 되니까.
export function computeGpa(
  courses: { credit: number; grade: string | null }[]
): number | null {
  let totalPoints = 0;
  let totalCredits = 0;

  for (const course of courses) {
    const point = gradePoint(course.grade);
    if (point === null || course.credit <= 0) continue;
    totalPoints += point * course.credit;
    totalCredits += course.credit;
  }

  if (totalCredits === 0) return null;
  return totalPoints / totalCredits;
}

export function formatGpa(gpa: number | null): string {
  return gpa === null ? "—" : gpa.toFixed(2);
}
