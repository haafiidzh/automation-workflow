import fs from "fs";
import { NextResponse } from "next/server";
import { getProjectById, isWithinAllowedRoot } from "@/lib/registry";
import { scanProject } from "@/lib/claude-dir";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProjectById(id);

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan di registry" }, { status: 404 });
  }

  if (!fs.existsSync(project.path) || !fs.statSync(project.path).isDirectory()) {
    return NextResponse.json(
      { error: `Path project tidak ada atau bukan direktori: ${project.path}` },
      { status: 400 }
    );
  }

  if (!isWithinAllowedRoot(project.path)) {
    return NextResponse.json(
      { error: "Path project di luar ALLOWED_PROJECT_ROOT" },
      { status: 403 }
    );
  }

  const scan = scanProject(project.path);
  return NextResponse.json(scan);
}
