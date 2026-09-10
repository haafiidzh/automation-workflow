export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, same cap for every file type

export type AttachmentKind = "image" | "pdf" | "excel";

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);
const PDF_MIME = "application/pdf";

export function kindForMime(mime: string): AttachmentKind | undefined {
  if (IMAGE_MIMES.has(mime)) return "image";
  if (mime === PDF_MIME) return "pdf";
  if (EXCEL_MIMES.has(mime)) return "excel";
  return undefined;
}

export type ValidationResult =
  | { ok: true; kind: AttachmentKind; mime: string }
  | { ok: false; error: string };

/**
 * Validates size + MIME from the file's actual content (magic bytes), not the
 * client-supplied Content-Type/extension — those are easy to spoof.
 */
export async function validateUpload(buffer: Buffer): Promise<ValidationResult> {
  if (buffer.length === 0) {
    return { ok: false, error: "File kosong" };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `File melebihi batas ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` };
  }

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime;

  if (!mime) {
    return { ok: false, error: "Tipe file tidak terdeteksi" };
  }

  const kind = kindForMime(mime);
  if (!kind) {
    return { ok: false, error: `Tipe file "${mime}" tidak didukung (hanya gambar, PDF, Excel .xlsx)` };
  }

  return { ok: true, kind, mime };
}
