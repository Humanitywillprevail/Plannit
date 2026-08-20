"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireUserId } from "@/lib/auth/session";
import { generateNarrative } from "@/lib/analysis/generateNarrative";

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

// 대상 기록 중 아직 narrative가 없는 것만 생성한다. 버튼 클릭으로만 호출되며,
// 페이지 렌더링 중에는 절대 호출하지 않는다 (Next.js Server Component에서
// LLM 호출 + DB 쓰기를 하면 안 되는 이유는 app/layout.tsx의 connection() 관련
// 커밋 참고 — 비슷한 부류의 문제라 애초에 피한다).
export async function generatePendingNarratives(): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: {
      ...portfolioEligibleWhere(userId),
      narrative: { equals: Prisma.DbNull },
    },
  });

  for (const record of pending) {
    try {
      const narrative = await generateNarrative({
        content: record.content,
        summary: record.summary,
        background: record.background,
        process: record.process,
        outcome: record.outcome,
        growth: record.growth,
        competencyNote: record.competencyNote,
      });
      await prisma.record.update({
        where: { id: record.id },
        data: { narrative },
      });
    } catch (error) {
      // 개별 기록의 생성 실패가 나머지를 막으면 안 된다 (reanalyzeCourse와 동일 패턴).
      // 다음에 버튼을 다시 누르면 재시도된다.
      console.error(`generatePendingNarratives: record ${record.id} 생성 실패:`, error);
    }
  }

  revalidatePath("/portfolio");
}
