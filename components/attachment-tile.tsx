import { FileSpreadsheet, FileText, Image as ImageIcon, X } from "lucide-react";
import type { AttachmentMeta } from "@/lib/types";

export type DisplayAttachment = AttachmentMeta & { previewUrl?: string; status?: "uploading" | "done" | "error"; error?: string };

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toUpperCase();
}

export function attachmentIcon(kind: AttachmentMeta["kind"], className: string) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "excel") return <FileSpreadsheet className={className} />;
  return <FileText className={className} />;
}

export function AttachmentTile({
  att,
  onRemove,
}: {
  att: DisplayAttachment;
  onRemove?: () => void;
}) {
  const status = att.status ?? "done";
  return (
    <div
      className={
        "relative size-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center " +
        (status === "error" ? "border-destructive" : "border-border")
      }
      title={status === "error" ? att.error : att.name}
    >
      {att.kind === "image" && att.previewUrl ? (
        <img src={att.previewUrl} alt={att.name} className="size-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground px-1">
          {attachmentIcon(att.kind, "size-5")}
          <span className="text-[9px] font-medium uppercase leading-none truncate max-w-full">
            {fileExtension(att.name)}
          </span>
        </div>
      )}
      {status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="remove"
          className="absolute top-0.5 right-0.5 rounded-full bg-background/80 hover:bg-background text-foreground/70 hover:text-foreground p-0.5"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
