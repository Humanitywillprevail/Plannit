export const RECORD_TYPE_OPTIONS = [
  { value: "assignment", label: "과제" },
  { value: "exam", label: "시험" },
] as const;

export function recordTypeLabel(type: string): string {
  return RECORD_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

export const GRADE_OPTIONS = [
  "A+",
  "A0",
  "B+",
  "B0",
  "C+",
  "C0",
  "D+",
  "D0",
  "F",
] as const;

// 뱃지 색상은 앞글자(A/B/C/D/F) 기준 5단계로만 구분한다 (+/0는 텍스트로만 구분).
export function gradeTier(grade: string): "A" | "B" | "C" | "D" | "F" {
  const letter = grade[0]?.toUpperCase();
  if (letter === "A" || letter === "B" || letter === "C" || letter === "D") {
    return letter;
  }
  return "F";
}

// 이해도 자기평가(별점). 성적/키워드 분석과는 별개의 주관적 지표.
export const SELF_RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

// 나중에 만들 "포트폴리오 자동 생성"(7단계 스토리 구조)에 쓸 선택 입력 필드.
export const PORTFOLIO_FIELD_OPTIONS = [
  { value: "summary", label: "소개 (한 줄 요약)" },
  { value: "background", label: "배경/목적" },
  { value: "process", label: "과정" },
  { value: "outcome", label: "결과물" },
  { value: "growth", label: "성장한 점" },
  { value: "competencyNote", label: "나의 역량" },
] as const;
