/**
 * Project scanning logic, independent of where the files come from.
 *
 * The scan itself never touches `fs`: it reads through an `FsSource`, or
 * interprets a `ScanInput` a browser already collected. Frontmatter parsing
 * stays here — `gray-matter` requires `fs`, so this module is server-only.
 * Browser code imports `lib/fs-source.ts` instead.
 */

import matter from "gray-matter";
import {
  claudePaths,
  collectScanInput,
  joinPath,
  memoryFsSource,
  type FsSource,
  type ScanInput,
} from "./fs-source";
import type { AgentInfo, ProjectScanResponse } from "./types";

export type { DirEntry, FsSource, ScanInput } from "./fs-source";

function fileNames(entries: { name: string; type: "file" | "dir" }[] | null | undefined): string[] {
  return (entries ?? []).filter((e) => e.type === "file").map((e) => e.name);
}

/** Interprets an already-collected scan. No I/O of any kind happens here. */
export function scanProjectFromInput(input: ScanInput): ProjectScanResponse {
  const { projectPath } = input;
  const { agentsDir, docsDir, rulesDir } = claudePaths(projectPath);

  const missing: string[] = [];
  if (!input.dirs[projectPath]) missing.push("project path tidak ditemukan");
  if (!input.dirs[agentsDir]) missing.push(".claude/agents/");
  if (!input.dirs[docsDir]) missing.push(".claude/docs/");
  if (!fileNames(input.dirs[rulesDir]).includes("tasking.md")) {
    missing.push(".claude/rules/tasking.md");
  }

  const valid = missing.length === 0;

  const agents: AgentInfo[] = valid
    ? fileNames(input.dirs[agentsDir])
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          const raw = input.files[joinPath(agentsDir, f)] ?? "";
          const { data } = matter(raw);
          return {
            name: (data.name as string) || f.replace(/\.md$/, ""),
            description: (data.description as string) || "",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const docsFiles = valid
    ? fileNames(input.dirs[docsDir]).sort((a, b) => a.localeCompare(b))
    : [];

  return { validation: { valid, missing }, agents, docsFiles };
}

/**
 * Concatenates .claude/rules/, tasking.md first then the rest alphabetically.
 * Throws when tasking.md is absent — callers must fail the session clearly.
 */
export function readRulesFromInput(input: ScanInput): string {
  const { rulesDir } = claudePaths(input.projectPath);
  const names = fileNames(input.dirs[rulesDir]);
  if (!names.includes("tasking.md")) {
    throw new Error(`.claude/rules/tasking.md tidak ditemukan di ${input.projectPath}`);
  }

  return names
    .sort((a, b) => {
      if (a === "tasking.md") return -1;
      if (b === "tasking.md") return 1;
      return a.localeCompare(b);
    })
    .map((f) => `## Rules: ${f}\n\n${input.files[joinPath(rulesDir, f)] ?? ""}`)
    .join("\n\n---\n\n");
}

/**
 * The full text of one agent definition, so the SDK can be handed the agent
 * directly instead of loading it from `.claude/agents/` on disk.
 *
 * That matters when the project lives on the user's machine: the server has no
 * copy of the file, and an agent loaded from disk would also carry its own
 * `tools:` list, which silently re-enables the server-side Read/Glob/Grep the
 * bridge exists to replace.
 */
export function getAgentDefinition(
  input: ScanInput,
  agentName: string
): { description: string; prompt: string } | null {
  const { agentsDir } = claudePaths(input.projectPath);
  for (const name of fileNames(input.dirs[agentsDir])) {
    if (!name.endsWith(".md")) continue;
    const raw = input.files[joinPath(agentsDir, name)];
    if (raw == null) continue;
    const { data, content } = matter(raw);
    const resolved = (data.name as string) || name.replace(/\.md$/, "");
    if (resolved !== agentName) continue;
    return { description: (data.description as string) || "", prompt: content.trim() };
  }
  return null;
}

export async function scanProjectFrom(
  src: FsSource,
  projectPath: string
): Promise<ProjectScanResponse> {
  return scanProjectFromInput(await collectScanInput(src, projectPath, { includeRules: false }));
}

export async function readRulesContentFrom(
  src: FsSource,
  projectPath: string
): Promise<string> {
  return readRulesFromInput(await collectScanInput(src, projectPath));
}

export { memoryFsSource };
