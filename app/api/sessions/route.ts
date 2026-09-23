import { NextRequest } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId wajib diisi" }), { status: 400 });
  }
  return Response.json(listSessions(projectId, user.id));
}
