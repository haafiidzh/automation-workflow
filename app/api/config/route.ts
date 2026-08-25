import { NextResponse } from "next/server";
import { getNotionAccounts, getProjects } from "@/lib/registry";
import type { ConfigResponse } from "@/lib/types";

export async function GET() {
  const body: ConfigResponse = {
    projects: getProjects(),
    notionAccounts: getNotionAccounts(),
  };
  return NextResponse.json(body);
}
