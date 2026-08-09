"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";

export async function createSemester(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.semester.create({ data: { userId, name } });

  revalidatePath("/semesters");
}
