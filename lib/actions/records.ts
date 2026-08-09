"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { reanalyzeCourse } from "@/lib/analysis/reanalyze";
import { deleteUploadedFile, saveUploadedFile, MAX_FILES_PER_UPLOAD } from "@/lib/files";

export async function addRecord(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const courseId = Number(formData.get("courseId"));
  const type = String(formData.get("type") ?? "other");
  const content = String(formData.get("content") ?? "").trim();

  if (!courseId || !content) return;

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { semesterId: true },
  });
  if (!course) return;

  const record = await prisma.record.create({
    data: { userId, courseId, type, content },
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
