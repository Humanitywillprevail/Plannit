"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";

export async function createCourse(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const semesterId = Number(formData.get("semesterId"));
  const name = String(formData.get("name") ?? "").trim();
  const credit = Number(formData.get("credit"));
  const grade = String(formData.get("grade") ?? "").trim();

  if (!semesterId || !name) return;

  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, userId },
    select: { id: true },
  });
  if (!semester) return;

  await prisma.course.create({
    data: {
      userId,
      semesterId,
      name,
      credit: Number.isFinite(credit) ? credit : 0,
      grade: grade || null,
    },
  });

  revalidatePath(`/semesters/${semesterId}`);
  revalidatePath("/semesters");
}

export async function updateCourse(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  const credit = Number(formData.get("credit"));
  const grade = String(formData.get("grade") ?? "").trim();
  if (!id) return;

  const course = await prisma.course.findFirst({ where: { id, userId } });
  if (!course) return;

  await prisma.course.update({
    where: { id },
    data: {
      credit: Number.isFinite(credit) ? credit : 0,
      grade: grade || null,
    },
  });

  revalidatePath(`/courses/${id}`);
  revalidatePath(`/semesters/${course.semesterId}`);
  revalidatePath("/semesters");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!id) return;

  const course = await prisma.course.findFirst({ where: { id, userId } });
  if (!course) return;

  await prisma.course.delete({ where: { id } });

  revalidatePath(`/semesters/${course.semesterId}`);
  revalidatePath("/semesters");
}
