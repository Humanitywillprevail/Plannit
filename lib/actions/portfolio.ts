"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { generateNarrative } from "@/lib/analysis/generateNarrative";
import { portfolioPendingWhere } from "@/lib/portfolio/queries";

// 대상 기록 중 아직 narrative가 없는 것만 생성한다. 버튼 클릭으로만 호출되며,
// 페이지 렌더링 중에는 절대 호출하지 않는다 (Next.js Server Component에서
// LLM 호출 + DB 쓰기를 하면 안 되는 이유는 app/layout.tsx의 connection() 관련
// 커밋 참고 — 비슷한 부류의 문제라 애초에 피한다).
//
// 한 번 호출당 최대 5건만 처리한다 — 대기 건수가 많으면 서버리스 함수의
// 실행 시간 제한을 넘길 수 있어서다. 5건보다 많이 남아 있으면 버튼을 다시
// 눌러 다음 배치를 처리한다.
// recordIds가 주어지면 그 범위로만 좁혀서 처리한다 (포트폴리오 선택 화면에서
// 선택된 기록 중 narrative 없는 것만 생성할 때 사용). 생략하면 계정 전체
// 대상으로 동작한다 — 과거 호출부 호환을 위한 것일 뿐, 새 코드는 항상
// recordIds를 넘긴다.
export async function generatePendingNarratives(recordIds?: number[]): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: recordIds
      ? { ...portfolioPendingWhere(userId), id: { in: recordIds } }
      : portfolioPendingWhere(userId),
    take: 5,
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
