import fs from "fs";
import {
  claudePaths,
  joinPath,
  FsSourceError,
  type DirEntry,
  type FsSource,
  type ScanInput,
} from "./fs-source";
import { readRulesFromInput, scanProjectFromInput } from "./project-scan";
import type { ProjectScanResponse } from "./types";

/** `FsSource` over Node `fs` — the server's own disk. */
export function nodeFsSource(): FsSource {
  return {
    async list(path: string): Promise<DirEntry[]> {
      try {
        return fs
          .readdirSync(path, { withFileTypes: true })
          .map((d) => ({ name: d.name, type: d.isDirectory() ? "dir" : "file" }));
      } catch (err) {
        throw toFsSourceError(path, err);
      }
    },
    async read(path: string): Promise<string> {
      try {
        return fs.readFileSync(path, "utf-8");
      } catch (err) {
        throw toFsSourceError(path, err);
      }
    },
  };
}

function toFsSourceError(path: string, err: unknown): FsSourceError {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return new FsSourceError("not-found", `${path} does not exist`);
  }
  if (code === "EACCES" || code === "EPERM") {
    return new FsSourceError("forbidden", `${path} is not readable`);
  }
  return new FsSourceError("unknown", err instanceof Error ? err.message : String(err));
}

function listSync(path: string): DirEntry[] | null {
  try {
    return fs
      .readdirSync(path, { withFileTypes: true })
      .map((d) => ({ name: d.name, type: d.isDirectory() ? "dir" : ("file" as const) }));
  } catch {
    return null;
  }
}

/**
 * Synchronous twin of `collectScanInput`, kept so the existing synchronous call
 * sites keep working. The interpretation is shared with the async path — only
 * the reading differs.
 */
function collectScanInputSync(
  projectPath: string,
  opts: { includeRules?: boolean } = {}
): ScanInput {
  const includeRules = opts.includeRules ?? true;
  const { agentsDir, docsDir, rulesDir } = claudePaths(projectPath);

  const dirs: ScanInput["dirs"] = {
    [projectPath]: listSync(projectPath),
    [agentsDir]: listSync(agentsDir),
    [docsDir]: listSync(docsDir),
    [rulesDir]: listSync(rulesDir),
  };

  const files: ScanInput["files"] = {};
  const readInto = (dir: string, name: string) => {
    const full = joinPath(dir, name);
    try {
      files[full] = fs.readFileSync(full, "utf-8");
    } catch {
      files[full] = null;
    }
  };

  for (const e of dirs[agentsDir] ?? []) {
    if (e.type === "file" && e.name.endsWith(".md")) readInto(agentsDir, e.name);
  }
  if (includeRules) {
    for (const e of dirs[rulesDir] ?? []) {
      if (e.type === "file") readInto(rulesDir, e.name);
    }
  }

  return { projectPath, dirs, files };
}

export function scanProject(projectPath: string): ProjectScanResponse {
  return scanProjectFromInput(collectScanInputSync(projectPath, { includeRules: false }));
}

/**
 * Reads all files in .claude/rules/, tasking.md first, rest alphabetical.
 * Throws if tasking.md is missing — callers must fail the session clearly.
 */
export function readRulesContent(projectPath: string): string {
  return readRulesFromInput(collectScanInputSync(projectPath));
}
