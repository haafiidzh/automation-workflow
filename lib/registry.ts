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

export function getProjects(): Project[] {
  const filePath = path.join(WORKFLOW_DIR, "projects.md");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parseMarkdownTable(raw);
  return rows
    .filter((r) => r.id)
    .map((r) => {
      const projectPath = expandHome(r.path ?? "");
      if (!isWithinAllowedRoot(projectPath)) {
        return {
          id: r.id,
          label: r.label ?? r.id,
          path: projectPath,
          valid: false,
          missing: ["di luar ALLOWED_PROJECT_ROOT"],
        };
      }
      const scan = scanProject(projectPath);
      return {
        id: r.id,
        label: r.label ?? r.id,
        path: projectPath,
        valid: scan.validation.valid,
        missing: scan.validation.missing,
      };
    });
}

export function getNotionAccounts(): NotionAccount[] {
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
      };
    });
}

export function getProjectById(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}
