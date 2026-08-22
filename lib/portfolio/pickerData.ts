import { prisma } from "@/lib/db/client";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";
import type { PickerSemester } from "@/components/PortfolioRecordPicker";

// PortfolioRecordPicker에 넘길 데이터를 만든다. "포트폴리오 대상"이 될 수
// 있는 기록이 하나도 없는 과목/학기는 아예 빼서, 고를 게 없는 빈 카드가
// 뜨지 않게 한다.
export async function buildPickerSemesters(userId: string): Promise<PickerSemester[]> {
  const semesters = await prisma.semester.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      courses: {
        orderBy: { createdAt: "asc" },
        include: {
          records: {
            where: portfolioEligibleWhere(userId),
            orderBy: { createdAt: "desc" },
            select: { id: true, content: true, narrative: true },
          },
        },
      },
    },
  });

  return semesters
    .map((s) => ({
      id: s.id,
      name: s.name,
      courses: s.courses
        .filter((c) => c.records.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          records: c.records.map((r) => ({
            id: r.id,
            content: r.content,
            hasNarrative: r.narrative !== null,
          })),
        })),
    }))
    .filter((s) => s.courses.length > 0);
}
