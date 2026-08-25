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
