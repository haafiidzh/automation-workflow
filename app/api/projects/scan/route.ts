import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { scanProjectFromInput } from "@/lib/project-scan";
import type { ScanInput } from "@/lib/fs-source";

/**
 * Interprets a project scan the browser collected from the user's machine.
 *
 * Everything in the body is untrusted: it was assembled in a tab, by a local
 * agent this server cannot see. None of it is ever used for a filesystem
 * operation here — the paths are only keys into the payload itself, and the
 * result only affects what that same user sees.
 */

/** Hard cap on the request body. Ten projects of rules and agents fit easily. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MAX_PATH_LENGTH = 4096;
const MAX_ENTRIES_PER_DIR = 2000;
const MAX_FILE_CHARS = 1024 * 1024;
const MAX_PROJECTS = 50;

const dirEntrySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["file", "dir"]),
});

const scanInputSchema = z.object({
  projectPath: z.string().min(1).max(MAX_PATH_LENGTH),
  dirs: z.record(
    z.string().max(MAX_PATH_LENGTH),
    z.array(dirEntrySchema).max(MAX_ENTRIES_PER_DIR).nullable()
  ),
  files: z.record(
    z.string().max(MAX_PATH_LENGTH),
    z.string().max(MAX_FILE_CHARS).nullable()
  ),
});

const bodySchema = z.object({
  inputs: z.array(scanInputSchema).min(1).max(MAX_PROJECTS),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const raw = await req.text();
  // Byte length, not character count: a multi-byte payload must not slip past.
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Payload scan lebih besar dari ${MAX_BODY_BYTES} byte` },
      { status: 413 }
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang valid" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bentuk payload scan tidak sesuai", detail: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }

  const scans = parsed.data.inputs.map((input) => ({
    projectPath: input.projectPath,
    scan: scanProjectFromInput(input as ScanInput),
  }));

  return NextResponse.json({ scans });
}
