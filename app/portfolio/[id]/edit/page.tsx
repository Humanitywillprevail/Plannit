import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { updatePortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { records: { select: { recordId: true } } },
  });
  if (!portfolio) notFound();

  const semesters = await buildPickerSemesters(userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오 수정"
        backHref={`/portfolio/${portfolio.id}`}
        backLabel="포트폴리오로 돌아가기"
      />
      <PortfolioForm
        action={updatePortfolio}
        initialName={portfolio.name}
        initialJobRole={portfolio.targetJobRole}
        hiddenFields={{ portfolioId: portfolio.id }}
        semesters={semesters}
        initialSelectedIds={portfolio.records.map((r) => r.recordId)}
        submitLabel="저장"
      />
    </main>
  );
}
