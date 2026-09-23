import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSessionById, getSessionOwner } from "@/lib/sessions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const record = getSessionById(id);
  // Someone else's session answers 404, not 403: a 403 would confirm the id is
  // real and leak which sessions exist.
  if (!record || getSessionOwner(id) !== user.id) {
    return NextResponse.json({ error: "Session tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(record);
}
