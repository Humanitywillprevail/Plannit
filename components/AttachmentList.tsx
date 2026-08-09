import { FileText } from "lucide-react";
import DeleteForm from "@/components/DeleteForm";
import { deleteAttachment } from "@/lib/actions/records";
import { formatFileSize } from "@/lib/files";

type Attachment = {
  id: number;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
};

export default function AttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {attachments.map((a) => {
        const isImage = a.mimeType.startsWith("image/");
        return (
          <div
            key={a.id}
            className="flex items-center gap-1.5 rounded-lg border border-line py-1 pr-1.5 pl-1 text-xs"
          >
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              title={a.fileName}
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 파일은 next/image 최적화 대상이 아님
                <img
                  src={a.url}
                  alt={a.fileName}
                  className="size-8 rounded object-cover"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded bg-black/[0.04] dark:bg-white/[0.06]">
                  <FileText className="size-4 text-ink-muted" />
                </span>
              )}
              <span className="max-w-[120px] truncate">{a.fileName}</span>
              <span className="shrink-0 text-ink-muted">
                {formatFileSize(a.size)}
              </span>
            </a>
            <DeleteForm
              action={deleteAttachment}
              hiddenFields={{ id: a.id }}
              confirmMessage="이 첨부파일을 삭제할까요?"
              label="×"
              className="px-1 text-sm text-ink-muted hover:text-danger"
            />
          </div>
        );
      })}
    </div>
  );
}
