import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNotionAccounts, getProjects } from "@/lib/registry";
import type { ConfigResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  // With a local agent paired, the project list belongs to the user's machine
  // and the browser assembles it. The server must not scan its own disk then:
  // on a VPS those paths are either absent or somebody else's.
  const localAgent = req.nextUrl.searchParams.get("localAgent") === "1";

  const body: ConfigResponse = {
    projects: localAgent ? [] : getProjects(),
    notionAccounts: getNotionAccounts(user.id),
    needsClientScan: localAgent,
  };
  return NextResponse.json(body);
}
