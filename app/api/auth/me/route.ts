import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  // getCurrentUser never carries passwordHash; keep it that way.
  return NextResponse.json(user);
}
