import fs from "fs";
import path from "path";
import type { SessionRecord, SessionSummary, SessionTurn } from "./types";

const WORKFLOW_DIR = path.join(process.cwd(), "workflow");
const SESSIONS_DIR = path.join(WORKFLOW_DIR, "sessions");

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

function sessionFilePath(sessionId: string): string {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function previewFrom(turns: SessionTurn[]): string {
  const first = turns.find((t) => t.role === "user");
  const text = (first?.text ?? "").trim().replace(/\s+/g, " ");
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function appendSessionTurn(params: {
  sessionId: string;
  projectId: string;
  agentName: string;
  notionAccountId: string;
  userTurn: SessionTurn;
  assistantTurn: SessionTurn;
  numTurns: number;
  isError: boolean;
}): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const filePath = sessionFilePath(params.sessionId);
  const now = new Date().toISOString();

  let record: SessionRecord;
  if (fs.existsSync(filePath)) {
    record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SessionRecord;
    record.turns.push(params.userTurn, params.assistantTurn);
  } else {
    record = {
      sessionId: params.sessionId,
      projectId: params.projectId,
      agentName: params.agentName,
      notionAccountId: params.notionAccountId,
      createdAt: now,
      updatedAt: now,
      numTurns: 0,
      status: "ok",
      turns: [params.userTurn, params.assistantTurn],
    };
  }
  record.updatedAt = now;
  record.numTurns = params.numTurns;
  record.status = params.isError ? "error" : "ok";

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
}

export function listSessions(projectId: string): SessionSummary[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));

  const summaries: SessionSummary[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), "utf-8");
      const record = JSON.parse(raw) as SessionRecord;
      if (record.projectId !== projectId) continue;
      const { turns, ...rest } = record;
      summaries.push({ ...rest, preview: previewFrom(turns) });
    } catch {
      // skip corrupt/partial file
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSessionById(sessionId: string): SessionRecord | undefined {
  let filePath: string;
  try {
    filePath = sessionFilePath(sessionId);
  } catch {
    return undefined;
  }
  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) return undefined;
  return JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf-8")) as SessionRecord;
}
