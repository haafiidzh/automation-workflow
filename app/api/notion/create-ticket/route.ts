import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNotionAccounts } from "@/lib/registry";
import { getSessionOwner } from "@/lib/sessions";
import { getStorageDriver } from "@/lib/storage";
import { createNotionPage, type NotionFileAttachment, type NotionTicket } from "@/lib/notion";
import type { AttachmentMeta } from "@/lib/types";

type CreateTicketBody = {
  notionAccountId: string;
  ticket: NotionTicket;
  sessionId?: string;
  attachments?: AttachmentMeta[];
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = (await req.json()) as CreateTicketBody;
  const { notionAccountId, ticket, sessionId, attachments } = body;

  if (!notionAccountId || !ticket?.database_id || !ticket?.properties) {
    return NextResponse.json({ error: "notionAccountId dan ticket wajib diisi" }, { status: 400 });
  }
  if (attachments?.length && !sessionId) {
    return NextResponse.json({ error: "sessionId wajib diisi kalau ada attachments" }, { status: 400 });
  }

  if (sessionId && getSessionOwner(sessionId) !== user.id) {
    return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
  }

  // Scoped lookup: an account belonging to another user is simply not found,
  // so its token can never be reached by guessing the id.
  const account = getNotionAccounts(user.id).find((n) => n.id === notionAccountId);
  if (!account) {
    return NextResponse.json({ error: "Akun Notion tidak ditemukan di registry" }, { status: 404 });
  }

  const token = process.env[account.env];
  if (!token) {
    return NextResponse.json(
      { error: `Env var ${account.env} kosong — cek .env.local` },
      { status: 400 }
    );
  }

  try {
    let fileAttachments: NotionFileAttachment[] = [];
    if (attachments?.length && sessionId) {
      const storage = getStorageDriver();
      fileAttachments = await Promise.all(
        attachments.map(async (att) => ({
          buffer: await storage.read(sessionId, att.fileId),
          filename: att.name,
          mime: att.mime,
          kind: att.kind,
        }))
      );
    }

    const page = await createNotionPage(token, ticket, fileAttachments);
    return NextResponse.json({ url: page.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat page Notion" },
      { status: 502 }
    );
  }
}
