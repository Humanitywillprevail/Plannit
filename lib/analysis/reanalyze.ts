import { prisma } from "@/lib/db/client";
import { analyzeCourseCompetencies } from "./analyzeCourse";

// 과목의 Record가 추가/변경될 때마다 호출되어 CourseCompetency를 다시 계산한다.
// MVP 규모에서는 매번 통째로 지우고 다시 쓰는 편이 upsert diff보다 단순하고 안전하다.
export async function reanalyzeCourse(courseId: number): Promise<void> {
  const records = await prisma.record.findMany({
    where: { courseId },
    select: { content: true },
  });

  let results: Awaited<ReturnType<typeof analyzeCourseCompetencies>>;
  try {
    results = await analyzeCourseCompetencies(records);
  } catch (error) {
    // AI Gateway 호출 실패(네트워크/레이트리밋 등)로 기록 추가 자체가 실패하면 안 되므로,
    // 이번 재분석만 건너뛴다. 다음 기록 추가/삭제 때 다시 시도된다.
    console.error(`reanalyzeCourse(${courseId}) 역량 분석 실패:`, error);
    return;
  }

  await prisma.courseCompetency.deleteMany({ where: { courseId } });

  if (results.length === 0) return;

  const competencies = await prisma.competency.findMany({
    where: { key: { in: results.map((r) => r.competencyKey) } },
  });
  const competencyIdByKey = new Map(competencies.map((c) => [c.key, c.id]));

  const data = results
    .filter((r) => competencyIdByKey.has(r.competencyKey))
    .map((r) => ({
      courseId,
      competencyId: competencyIdByKey.get(r.competencyKey)!,
      score: r.score,
      matchedKeywords: r.matchedKeywords.join(","),
      evidence: r.evidence,
    }));

  await prisma.courseCompetency.createMany({ data });
}
