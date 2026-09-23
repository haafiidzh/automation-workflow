import fs from "fs";
import path from "path";
import type { NotionAccount, Project } from "./types";
import { scanProject } from "./claude-dir";

const WORKFLOW_DIR = path.join(process.cwd(), "workflow");

/**
 * Parses a single GFM pipe-table out of markdown text into an array of
 * row objects keyed by the header column names (lowercased).
 */
function parseMarkdownTable(markdown: string): Record<string, string>[] {
  const lines = markdown.split("\n").map((l) => l.trim());
  const tableStart = lines.findIndex((l) => l.startsWith("|"));
  if (tableStart === -1) return [];

  const tableLines: string[] = [];
  for (let i = tableStart; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) break;
    tableLines.push(lines[i]);
  }
  // tableLines[0] = header, tableLines[1] = separator, rest = data
  if (tableLines.length < 3) return [];

  const splitRow = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = splitRow(tableLines[0]).map((h) => h.toLowerCase());
  const rows = tableLines.slice(2);

  return rows.map((row) => {
    const cells = splitRow(row);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
}

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME ?? "", p.slice(1));
  }
  return p;
}

export function isWithinAllowedRoot(resolvedPath: string): boolean {
  const allowedRoot = process.env.ALLOWED_PROJECT_ROOT;
  if (!allowedRoot) return false;
  const root = path.resolve(expandHome(allowedRoot));
  const target = path.resolve(resolvedPath);
  return target === root || target.startsWith(root + path.sep);
}

export type ProjectRow = { id: string; label: string; path: string };

/**
 * The rows of `workflow/projects.md`, parsed but not scanned.
 *
 * This registry is the fallback for running Orchestrator on the same machine as
 * the projects. When a local agent is paired the project list comes from that
 * machine instead (`listProjects()`), and this file is not read at all.
 */
export function getProjectRows(): ProjectRow[] {
  const filePath = path.join(WORKFLOW_DIR, "projects.md");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseMarkdownTable(raw)
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      label: r.label ?? r.id,
      path: expandHome(r.path ?? ""),
    }));
}

export function getProjects(): Project[] {
  const rows = getProjectRows();
  return rows
    .map((r) => {
      // ALLOWED_PROJECT_ROOT only means something for paths on this machine,
      // so it is enforced here and skipped entirely on the paired path.
      if (!isWithinAllowedRoot(r.path)) {
        return { ...r, valid: false, missing: ["di luar ALLOWED_PROJECT_ROOT"] };
      }
      const scan = scanProject(r.path);
      return { ...r, valid: scan.validation.valid, missing: scan.validation.missing };
    });
}

/**
 * Accounts visible to one user. A row with an empty `user` column is shared by
 * every user on purpose — that is how a team Notion workspace is registered.
 * Passing no userId returns every account and must only be done from code that
 * has already established there is no user to scope to.
 */
export function getNotionAccounts(userId?: string): NotionAccount[] {
  const filePath = path.join(WORKFLOW_DIR, "notion-accounts.md");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parseMarkdownTable(raw);
  return rows
    .filter((r) => r.id)
    .map((r) => {
      const envName = r.env ?? "";
      const value = envName ? process.env[envName] : undefined;
      return {
        id: r.id,
        label: r.label ?? r.id,
        env: envName,
        workspace: r.workspace ?? "",
        available: Boolean(value && value.trim().length > 0),
        user: (r.user ?? "").trim(),
      };
    })
    .filter((a) => !userId || a.user === "" || a.user === userId);
}

export function getProjectById(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}
