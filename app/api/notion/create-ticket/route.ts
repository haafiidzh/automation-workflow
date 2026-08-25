import { NextRequest, NextResponse } from "next/server";
import { getNotionAccounts } from "@/lib/registry";
import { createNotionPage, type NotionTicket } from "@/lib/notion";

type CreateTicketBody = {
  notionAccountId: string;
  ticket: NotionTicket;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateTicketBody;
  const { notionAccountId, ticket } = body;

  if (!notionAccountId || !ticket?.database_id || !ticket?.properties) {
    return NextResponse.json({ error: "notionAccountId dan ticket wajib diisi" }, { status: 400 });
  }

  const account = getNotionAccounts().find((n) => n.id === notionAccountId);
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
    const page = await createNotionPage(token, ticket);
    return NextResponse.json({ url: page.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat page Notion" },
      { status: 502 }
    );
  }
}
