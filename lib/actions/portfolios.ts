"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";
import { analyzeJobRoleRequirements } from "@/lib/analysis/analyzeJobRole";
import { buildGapReport, type GapReport } from "@/lib/analysis/gapReport";
import {
  recommendActivities,
  type RecommendationCandidateRow,
  type RecommendationItem,
} from "@/lib/analysis/recommendActivities";

export type PortfolioFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

function readRecordIds(formData: FormData): number[] {
  return formData
    .getAll("recordIds")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

// 선택된 recordIds가 실제로 이 사용자의 "포트폴리오 대상" 기록인지 검증한다
// (클라이언트가 조작한 값을 그대로 믿지 않는다 — 다른 사용자 기록 ID를
// 끼워넣어도 이 카운트 비교에서 걸러진다).
async function validateRecordIds(userId: string, recordIds: number[]): Promise<boolean> {
  const eligibleCount = await prisma.record.count({
    where: { ...portfolioEligibleWhere(userId), id: { in: recordIds } },
  });
  return eligibleCount === recordIds.length;
}

export async function createPortfolio(
  prevState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  const targetJobRole = String(formData.get("targetJobRole") ?? "").trim();
  const recordIds = readRecordIds(formData);

  if (!name || !targetJobRole) {
    return { status: "error", message: "이름과 목표 직무를 입력해주세요." };
  }
  if (recordIds.length === 0) {
    return { status: "error", message: "포함할 활동을 최소 1개 선택해주세요." };
  }
  if (!(await validateRecordIds(userId, recordIds))) {
    return { status: "error", message: "선택한 활동을 확인할 수 없어요. 다시 시도해주세요." };
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      userId,
      name,
      targetJobRole,
      records: { create: recordIds.map((recordId) => ({ recordId })) },
    },
  });

  redirect(`/portfolio/${portfolio.id}`);
}

export async function updatePortfolio(
  prevState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const userId = await requireUserId();

  const portfolioId = Number(formData.get("portfolioId"));
  const name = String(formData.get("name") ?? "").trim();
  const targetJobRole = String(formData.get("targetJobRole") ?? "").trim();
  const recordIds = readRecordIds(formData);

  if (!name || !targetJobRole) {
    return { status: "error", message: "이름과 목표 직무를 입력해주세요." };
  }
  if (recordIds.length === 0) {
    return { status: "error", message: "포함할 활동을 최소 1개 선택해주세요." };
  }

  const existing = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId } });
  if (!existing) {
    return { status: "error", message: "포트폴리오를 찾을 수 없어요." };
  }
  if (!(await validateRecordIds(userId, recordIds))) {
    return { status: "error", message: "선택한 활동을 확인할 수 없어요. 다시 시도해주세요." };
  }

  await prisma.$transaction([
    prisma.portfolioRecord.deleteMany({ where: { portfolioId } }),
    prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        name,
        targetJobRole,
        records: { create: recordIds.map((recordId) => ({ recordId })) },
      },
    }),
  ]);

  redirect(`/portfolio/${portfolioId}`);
}

export type PortfolioFeedback = {
  summaryParagraph: string;
  gaps: GapReport["items"];
  recommendations: RecommendationItem[];
};

// Approach A (design spec): 역량 분석은 과목(Course) 단위로 그대로 재사용한다.
// 선택된 기록들이 속한 과목들로만 CourseCompetency를 좁혀서 buildGapReport에
// 넘기고, 추천은 "포트폴리오 밖 과목들" 중 부족한 역량 점수가 높은 과목을
// 순수 코드로 찾는다. 이 함수 안에서 새 LLM 호출은 analyzeJobRoleRequirements
// 단 하나뿐이다.
export async function analyzePortfolio(
  portfolioId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { records: { select: { recordId: true, record: { select: { courseId: true } } } } },
  });
  if (!portfolio) {
    return { ok: false, message: "포트폴리오를 찾을 수 없어요." };
  }

  const selectedCourseIds = [...new Set(portfolio.records.map((pr) => pr.record.courseId))];
  if (selectedCourseIds.length === 0) {
    return { ok: false, message: "선택된 활동이 없어서 분석할 수 없어요." };
  }

  const currentRows = await prisma.courseCompetency.findMany({
    where: { course: { userId }, courseId: { in: selectedCourseIds } },
    include: {
      competency: { select: { key: true, name: true, category: true } },
      course: { select: { id: true } },
    },
  });

  try {
    const requirements = await analyzeJobRoleRequirements(portfolio.targetJobRole);
    const gapReport = buildGapReport(currentRows, requirements, portfolio.targetJobRole);

    const otherCourseRows: RecommendationCandidateRow[] = await prisma.courseCompetency.findMany({
      where: { course: { userId }, courseId: { notIn: selectedCourseIds } },
      select: {
        score: true,
        competency: { select: { key: true } },
        course: { select: { id: true, name: true } },
      },
    });

    const selectedRecordIds = new Set(portfolio.records.map((pr) => pr.recordId));
    const otherCourseIds = [...new Set(otherCourseRows.map((r) => r.course.id))];
    const eligibleOtherRecords = await prisma.record.findMany({
      where: { ...portfolioEligibleWhere(userId), courseId: { in: otherCourseIds } },
      select: { id: true, courseId: true },
    });

    const eligibleRecordsByCourse = new Map<number, number[]>();
    for (const record of eligibleOtherRecords) {
      if (selectedRecordIds.has(record.id)) continue;
      const list = eligibleRecordsByCourse.get(record.courseId) ?? [];
      list.push(record.id);
      eligibleRecordsByCourse.set(record.courseId, list);
    }

    const recommendations = recommendActivities(gapReport.items, otherCourseRows, eligibleRecordsByCourse);

    const feedback: PortfolioFeedback = {
      summaryParagraph: gapReport.summaryParagraph,
      gaps: gapReport.items,
      recommendations,
    };

    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { feedback, analyzedAt: new Date() },
    });

    revalidatePath(`/portfolio/${portfolioId}`);
    return { ok: true };
  } catch (error) {
    console.error(`analyzePortfolio: portfolio ${portfolioId} 분석 실패:`, error);
    return {
      ok: false,
      message: "분석 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function deletePortfolio(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const portfolioId = Number(formData.get("portfolioId"));

  const portfolio = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId } });
  if (!portfolio) return;

  await prisma.portfolio.delete({ where: { id: portfolioId } });
  redirect("/portfolio");
}
