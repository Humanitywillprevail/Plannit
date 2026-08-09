import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_UPLOAD = 5;

const BUCKET = "attachments";

function safeExtension(originalName: string): string {
  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase().slice(0, 10);
  // 영문/숫자만 허용 — 원본 파일명은 절대 오브젝트 키 조합에 쓰지 않기 위한 최소한의 안전장치
  return /^\.[a-z0-9]+$/.test(ext) ? ext : "";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export type SavedFile = {
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
};

// File을 검증하고 오브젝트 스토리지(S3 호환 · attachments 버킷)에 업로드한다.
// 오브젝트 키는 항상 서버가 생성하고, 사용자가 올린 원본 파일명은 표시용 메타데이터로만 보관한다.
export async function saveUploadedFile(
  file: File,
  userId: string
): Promise<SavedFile | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) return null;

  const objectKey = `${userId}/${randomUUID()}${safeExtension(file.name)}`;
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(BUCKET).upload(objectKey, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);

  return {
    fileName: file.name,
    url: publicUrl,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function deleteUploadedFile(url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const objectKey = decodeURIComponent(url.slice(idx + marker.length));

  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([objectKey]);
}
