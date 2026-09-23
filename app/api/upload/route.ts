import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSessionOwner } from "@/lib/sessions";
import { getStorageDriver } from "@/lib/storage";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/upload-validation";
import type { AttachmentMeta } from "@/lib/types";

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const sessionId = form.get("sessionId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "field 'file' wajib diisi" }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json({ error: "field 'sessionId' wajib diisi dan valid" }, { status: 400 });
  }
  // A brand-new chat uploads under a draft id that has no session record yet;
  // that is allowed. An id that already belongs to someone else is not.
  const owner = getSessionOwner(sessionId);
  if (owner && owner !== user.id) {
    return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File melebihi batas ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateUpload(buffer);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const storage = getStorageDriver();
  const stored = await storage.save(sessionId, buffer);

  const meta: AttachmentMeta = {
    fileId: stored.fileId,
    name: file.name,
    mime: validation.mime,
    kind: validation.kind,
    size: stored.size,
  };

  return NextResponse.json(meta);
}
