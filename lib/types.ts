export type NotionCreateStatus =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "done"; url: string }
  | { state: "error"; message: string };

export type Project = {
  id: string;
  label: string;
  path: string;
  valid: boolean;
  missing: string[];
};

export type NotionAccount = {
  id: string;
  label: string;
  env: string;
  workspace: string;
  available: boolean;
};

export type ConfigResponse = {
  projects: Project[];
  notionAccounts: NotionAccount[];
};

export type AgentInfo = {
  name: string;
  description: string;
};

export type ProjectValidation = {
  valid: boolean;
  missing: string[];
};

export type ProjectScanResponse = {
  validation: ProjectValidation;
  agents: AgentInfo[];
  docsFiles: string[];
};

export type SessionToolCall = { name: string; input: Record<string, unknown> };

export type SessionTurn = {
  role: "user" | "assistant";
  text: string;
  toolCalls?: SessionToolCall[];
  timestamp: string;
};

export type SessionRecord = {
  sessionId: string;
  projectId: string;
  agentName: string;
  notionAccountId: string;
  createdAt: string;
  updatedAt: string;
  numTurns: number;
  status: "ok" | "error";
  turns: SessionTurn[];
};

export type SessionSummary = Omit<SessionRecord, "turns"> & {
  preview: string;
};
