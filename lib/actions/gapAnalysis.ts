"use server";

import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { analyzeJobRoleRequirements } from "@/lib/analysis/analyzeJobRole";
import { buildGapReport, type GapReport } from "@/lib/analysis/gapReport";

export type GapAnalysisState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "result"; report: GapReport };

// 결과를 DB에 저장하지 않는다 — 매 제출마다 새로 계산해서 페이지에만 보여준다
// (spec 참고: 직무명이 자유 텍스트라 캐싱 적중률이 낮고, 이번 라운드에서는
// "분석 이력"도 요구사항이 아니다). useActionState와 맞물려 동작하도록
// (prevState, formData) 시그니처를 그대로 따른다.
export async function analyzeJobGap(
  prevState: GapAnalysisState,
  formData: FormData
): Promise<GapAnalysisState> {
  const userId = await requireUserId();

  const jobRole = String(formData.get("jobRole") ?? "").trim();
  if (!jobRole) {
    return { status: "error", message: "직무를 입력해주세요." };
  }

  const currentRows = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    include: {
      competency: { select: { key: true, name: true, category: true } },
      course: { select: { id: true } },
    },
  });

  try {
    const requirements = await analyzeJobRoleRequirements(jobRole);
    const report = buildGapReport(currentRows, requirements, jobRole);
    return { status: "result", report };
  } catch (error) {
    console.error(`analyzeJobGap: "${jobRole}" 분석 실패:`, error);
    return {
      status: "error",
      message: "분석 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }
}
