import { NextRequest } from "next/server";
import { listSessions } from "@/lib/sessions";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId wajib diisi" }), { status: 400 });
  }
  return Response.json(listSessions(projectId));
}
