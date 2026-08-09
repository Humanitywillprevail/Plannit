import { prisma } from "@/lib/db/client";
import { analyzeCourseCompetencies } from "./analyzeCourse";

// 과목의 Record가 추가/변경될 때마다 호출되어 CourseCompetency를 다시 계산한다.
// MVP 규모에서는 매번 통째로 지우고 다시 쓰는 편이 upsert diff보다 단순하고 안전하다.
export async function reanalyzeCourse(courseId: number): Promise<void> {
  const records = await prisma.record.findMany({
    where: { courseId },
    select: { content: true },
  });
  const results = analyzeCourseCompetencies(records);

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
