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
  /** Owning user id, or "" for an account shared by everyone. */
  user: string;
};

/**
 * A project as the local agent reports it. When a local agent is paired this
 * replaces `workflow/projects.md` entirely — the list of projects is a property
 * of the user's machine, not of the server.
 */
export type LocalProject = {
  id: string;
  label: string;
  path: string;
  mode: "ro" | "rw";
};

export type ConfigResponse = {
  projects: Project[];
  notionAccounts: NotionAccount[];
  /** True when `projects` is empty because the browser must scan instead. */
  needsClientScan: boolean;
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

export type AttachmentMeta = {
  fileId: string;
  name: string;
  mime: string;
  kind: "image" | "pdf" | "excel";
  size: number;
};

export type SessionTurn = {
  role: "user" | "assistant";
  text: string;
  toolCalls?: SessionToolCall[];
  timestamp: string;
  notionStatuses?: NotionCreateStatus[];
  attachments?: AttachmentMeta[];
};

export type SessionRecord = {
  sessionId: string;
  /** Owner. Absent on records written before the auth layer existed. */
  userId?: string;
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

export type Disturbance =
  | { type: "note"; text: string }
  | { type: "doc"; fileName: string };

export type ResolvedDisturbance =
  | { type: "note"; text: string }
  | { type: "doc"; fileName: string; content: string };
