"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { reanalyzeCourse } from "@/lib/analysis/reanalyze";
import { deleteUploadedFile, saveUploadedFile, MAX_FILES_PER_UPLOAD } from "@/lib/files";
import { PORTFOLIO_FIELD_OPTIONS } from "@/lib/types";

// 빈 문자열은 "입력 안 함"이므로 null로 저장 — buildCompetencyReport 등
// 다른 로직이 "필드가 존재하지만 비어있음"과 구분할 필요가 없어서 단순하게 둔다.
function readOptionalField(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function addRecord(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const courseId = Number(formData.get("courseId"));
  const type = String(formData.get("type") ?? "other");
  const content = String(formData.get("content") ?? "").trim();
  const skillTags = Array.from(
    new Set(
      formData
        .getAll("skillTags")
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );

  if (!courseId || !content) return;

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { semesterId: true },
  });
  if (!course) return;

  const portfolioFields = Object.fromEntries(
    PORTFOLIO_FIELD_OPTIONS.map(({ value }) => [value, readOptionalField(formData, value)])
  );

  const record = await prisma.record.create({
    data: { userId, courseId, type, content, skillTags, ...portfolioFields },
  });
  await reanalyzeCourse(courseId);

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES_PER_UPLOAD);

  for (const file of files) {
    const saved = await saveUploadedFile(file, userId);
    if (!saved) continue; // 용량 초과 등으로 거부된 파일은 조용히 건너뜀
    await prisma.attachment.create({
      data: { recordId: record.id, ...saved },
    });
  }

  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/semesters/${course.semesterId}`);
  revalidatePath("/semesters");
}

export async function deleteRecord(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!id) return;

  const record = await prisma.record.findFirst({
    where: { id, userId },
    include: {
      attachments: { select: { url: true } },
      course: { select: { semesterId: true } },
    },
  });
  if (!record) return;

  await prisma.record.delete({ where: { id } });
  await Promise.all(
    record.attachments.map((a) => deleteUploadedFile(a.url))
  );
  await reanalyzeCourse(record.courseId);

  revalidatePath(`/courses/${record.courseId}`);
  revalidatePath(`/semesters/${record.course.semesterId}`);
  revalidatePath("/semesters");
}

export async function deleteAttachment(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!id) return;

  const attachment = await prisma.attachment.findFirst({
    where: { id, record: { userId } },
    include: { record: { select: { courseId: true } } },
  });
  if (!attachment) return;

  await prisma.attachment.delete({ where: { id } });
  await deleteUploadedFile(attachment.url);

  revalidatePath(`/courses/${attachment.record.courseId}`);
}
