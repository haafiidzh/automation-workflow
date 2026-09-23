import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSessionOwner, updateTurnNotionStatus } from "@/lib/sessions";
import type { NotionCreateStatus } from "@/lib/types";

type NotionStatusBody = {
  turnIndex: number;
  ticketIndex: number;
  status: NotionCreateStatus;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  if (getSessionOwner(id) !== user.id) {
    return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
  }

  const body = (await req.json()) as NotionStatusBody;
  const { turnIndex, ticketIndex, status } = body;

  if (
    typeof turnIndex !== "number" ||
    typeof ticketIndex !== "number" ||
    !status?.state
  ) {
    return NextResponse.json(
      { error: "turnIndex, ticketIndex, status wajib diisi" },
      { status: 400 }
    );
  }

  try {
    updateTurnNotionStatus({ sessionId: id, turnIndex, ticketIndex, status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan status Notion" },
      { status: 400 }
    );
  }
}
