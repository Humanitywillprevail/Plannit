import { Prisma } from "@/lib/generated/prisma/client";

// 6개 상세필드 중 하나라도 채워진 기록만 "포트폴리오 대상"으로 본다 —
// app/courses/[courseId]/page.tsx의 "포트폴리오 상세 보기" 토글과 동일한 기준.
export function portfolioEligibleWhere(userId: string): Prisma.RecordWhereInput {
  return {
    userId,
    OR: [
      { summary: { not: null } },
      { background: { not: null } },
      { process: { not: null } },
      { outcome: { not: null } },
      { growth: { not: null } },
      { competencyNote: { not: null } },
    ],
  };
}

// narrative가 아직 생성 안 된 대상 기록. Prisma.DbNull = "컬럼이 SQL NULL"
// (Prisma.JsonNull = "컬럼에 JSON null 리터럴이 저장됨"과는 다르다 — 이 프로젝트는
// narrative에 절대 JSON null을 쓰지 않으므로 DbNull이 맞다).
export function portfolioPendingWhere(userId: string): Prisma.RecordWhereInput {
  return {
    ...portfolioEligibleWhere(userId),
    narrative: { equals: Prisma.DbNull },
  };
}
