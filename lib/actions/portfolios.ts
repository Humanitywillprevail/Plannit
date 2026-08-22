"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";

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
