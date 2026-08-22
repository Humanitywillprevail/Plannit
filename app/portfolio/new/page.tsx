import Link from "next/link";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { createPortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function NewPortfolioPage() {
  const userId = await requireUserId();
  const semesters = await buildPickerSemesters(userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader title="새 포트폴리오 만들기" backHref="/portfolio" backLabel="포트폴리오 목록" />

      {semesters.length === 0 ? (
        <EmptyState
          message="아직 포트폴리오에 담을 수 있는 활동이 없어요. 과목 상세 페이지에서 기록의 '포트폴리오용 상세 입력'을 채워주세요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                학기 리스트로 가기
              </Button>
            </Link>
          }
        />
      ) : (
        <PortfolioForm action={createPortfolio} semesters={semesters} submitLabel="만들기" />
      )}
    </main>
  );
}
