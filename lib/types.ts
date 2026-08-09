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
