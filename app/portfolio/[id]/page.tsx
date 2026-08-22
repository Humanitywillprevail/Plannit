import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { NARRATIVE_SECTION_LABELS, type RecordNarrative } from "@/lib/analysis/generateNarrative";
import { deletePortfolio, type PortfolioFeedback } from "@/lib/actions/portfolios";
import PortfolioFeedbackPanel from "@/components/PortfolioFeedbackPanel";
import DeleteForm from "@/components/DeleteForm";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: {
      records: {
        orderBy: { record: { createdAt: "desc" } },
        include: { record: { include: { course: { select: { name: true } } } } },
      },
    },
  });

  if (!portfolio) notFound();

  const feedback = portfolio.feedback as unknown as PortfolioFeedback | null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title={portfolio.name}
        subtitle={portfolio.targetJobRole}
        backHref="/portfolio"
        backLabel="포트폴리오 목록"
        action={
          <div className="flex items-center gap-2">
            <Link href={`/portfolio/${portfolio.id}/edit`}>
              <Button variant="secondary" size="sm">
                수정
              </Button>
            </Link>
            <a href={`/portfolio/${portfolio.id}/pdf`}>
              <Button variant="secondary" size="sm">
                PDF 다운로드
              </Button>
            </a>
            <DeleteForm
              action={deletePortfolio}
              hiddenFields={{ portfolioId: portfolio.id }}
              confirmMessage="이 포트폴리오를 삭제할까요?"
            />
          </div>
        }
      />

      <PortfolioFeedbackPanel portfolioId={portfolio.id} feedback={feedback} analyzedAt={portfolio.analyzedAt} />

      {portfolio.records.length === 0 ? (
        <EmptyState message="선택된 활동이 모두 삭제됐어요. 수정에서 활동을 다시 골라주세요." />
      ) : (
        <ul className="space-y-4">
          {portfolio.records.map(({ record }) => {
            const narrative = record.narrative as unknown as RecordNarrative | null;
            return (
              <Card as="li" key={record.id}>
                <h2 className="mb-3 font-semibold">{record.course.name}</h2>
                {narrative ? (
                  <div className="space-y-3">
                    {NARRATIVE_SECTION_LABELS.map(({ key, label }) => (
                      <div key={key}>
                        <p className="text-xs text-ink-secondary">{label}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{narrative[key]}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">아직 이야기로 만들지 않았어요. 수정에서 생성할 수 있어요.</p>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
