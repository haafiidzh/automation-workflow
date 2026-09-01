import { NextResponse } from "next/server";
import { getSessionById } from "@/lib/sessions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = getSessionById(id);
  if (!record) {
    return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(record);
}
