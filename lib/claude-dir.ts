import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { AgentInfo, ProjectScanResponse } from "./types";

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function scanAgents(agentsDir: string): AgentInfo[] {
  if (!isDir(agentsDir)) return [];
  return fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const full = path.join(agentsDir, f);
      const raw = fs.readFileSync(full, "utf-8");
      const { data } = matter(raw);
      const nameFromFile = f.replace(/\.md$/, "");
      return {
        name: (data.name as string) || nameFromFile,
        description: (data.description as string) || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scanDocsFiles(docsDir: string): string[] {
  if (!isDir(docsDir)) return [];
  return fs
    .readdirSync(docsDir)
    .filter((f) => isFile(path.join(docsDir, f)))
    .sort((a, b) => a.localeCompare(b));
}

export function scanProject(projectPath: string): ProjectScanResponse {
  const claudeDir = path.join(projectPath, ".claude");
  const agentsDir = path.join(claudeDir, "agents");
  const docsDir = path.join(claudeDir, "docs");
  const rulesDir = path.join(claudeDir, "rules");
  const taskingFile = path.join(rulesDir, "tasking.md");

  const missing: string[] = [];
  if (!isDir(projectPath)) missing.push("project path tidak ditemukan");
  if (!isDir(agentsDir)) missing.push(".claude/agents/");
  if (!isDir(docsDir)) missing.push(".claude/docs/");
  if (!isFile(taskingFile)) missing.push(".claude/rules/tasking.md");

  const valid = missing.length === 0;

  return {
    validation: { valid, missing },
    agents: valid ? scanAgents(agentsDir) : [],
    docsFiles: valid ? scanDocsFiles(docsDir) : [],
  };
}

/**
 * Reads all files in .claude/rules/, tasking.md first, rest alphabetical.
 * Throws if tasking.md is missing — callers must fail the session clearly.
 */
export function readRulesContent(projectPath: string): string {
  const rulesDir = path.join(projectPath, ".claude", "rules");
  const taskingFile = path.join(rulesDir, "tasking.md");
  if (!isFile(taskingFile)) {
    throw new Error(
      `.claude/rules/tasking.md tidak ditemukan di ${projectPath}`
    );
  }

  const files = isDir(rulesDir)
    ? fs
        .readdirSync(rulesDir)
        .filter((f) => isFile(path.join(rulesDir, f)))
        .sort((a, b) => {
          if (a === "tasking.md") return -1;
          if (b === "tasking.md") return 1;
          return a.localeCompare(b);
        })
    : ["tasking.md"];

  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(rulesDir, f), "utf-8");
      return `## Rules: ${f}\n\n${content}`;
    })
    .join("\n\n---\n\n");
}
