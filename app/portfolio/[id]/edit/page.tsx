import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { updatePortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

// FormData가 아닌 쿼리스트링(?preselect=1,2,3)에서 읽는다는 점만 다를 뿐,
// lib/actions/portfolios.ts의 readRecordIds와 동일한 정수 필터링 규칙.
function parsePreselectIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

export default async function EditPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preselect?: string }>;
}) {
  const { id } = await params;
  const { preselect } = await searchParams;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { records: { select: { recordId: true } } },
  });
  if (!portfolio) notFound();

  const semesters = await buildPickerSemesters(userId);

  const existingSelectedIds = portfolio.records.map((r) => r.recordId);
  const preselectIds = parsePreselectIds(preselect);
  const initialSelectedIds = [...new Set([...existingSelectedIds, ...preselectIds])];

  // 기존에 포함돼 있던 기록 중, 이제는 더 이상 "포트폴리오 대상"이 아니라
  // (상세 필드가 모두 비워졌거나 삭제돼) 선택 화면에 아예 나타나지 않는 것들.
  // updatePortfolio는 저장 시 기록 집합을 diff가 아니라 통째로 교체하므로,
  // 이 상태에서 그냥 저장하면 사용자가 모르는 새 이 기록들이 조용히 빠진다.
  const pickableRecordIds = new Set(
    semesters.flatMap((s) => s.courses.flatMap((c) => c.records.map((r) => r.id)))
  );
  const droppedRecordCount = existingSelectedIds.filter((rid) => !pickableRecordIds.has(rid)).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오 수정"
        backHref={`/portfolio/${portfolio.id}`}
        backLabel="포트폴리오로 돌아가기"
      />
      {droppedRecordCount > 0 && (
        <p className="mb-4 text-sm text-danger">
          {droppedRecordCount}개의 기존 활동은 더 이상 선택할 수 없어요 — 저장하면 포트폴리오에서 빠져요.
        </p>
      )}
      <PortfolioForm
        action={updatePortfolio}
        initialName={portfolio.name}
        initialJobRole={portfolio.targetJobRole}
        hiddenFields={{ portfolioId: portfolio.id }}
        semesters={semesters}
        initialSelectedIds={initialSelectedIds}
        submitLabel="저장"
      />
    </main>
  );
}
