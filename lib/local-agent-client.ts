/**
 * Browser-side client for the local agent (see `local-agent/`).
 *
 * The VPS cannot reach the user's machine, so every call to the agent happens
 * here, in the tab, and the result is posted back to the server over
 * /api/local-fs/result.
 */

import { WRITE_OPS, type LocalFsOp } from "./local-fs-bridge";
import { FsSourceError, type DirEntry, type FsErrorCode, type FsSource } from "./fs-source";
import type { LocalProject } from "./types";

export const DEFAULT_PORT = 47821;
/** The agent walks this range when its default port is taken. */
export const PORT_RANGE = 10;

const TOKEN_KEY = "orchestrator.localAgent.token";
const PORT_KEY = "orchestrator.localAgent.port";

export type LocalAgentStatus =
  | { state: "disconnected"; portsExhausted?: boolean }
  | { state: "checking" }
  | { state: "unpaired"; port: number }
  | { state: "connected"; port: number; roots: number };

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    // Private mode / storage disabled: pairing simply will not persist.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function getCachedPort(): number | null {
  try {
    const raw = localStorage.getItem(PORT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function setCachedPort(port: number) {
  try {
    localStorage.setItem(PORT_KEY, String(port));
  } catch {
    // ignore
  }
}

function baseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes the cached port first, then the rest of the range, so a port conflict
 * on the user's machine does not look like "agent not installed".
 *
 * Also counts ports where *something* answered but not the agent (non-agent
 * process holding the port, or a stale/broken agent instance) — as opposed to
 * a plain connection refusal, which just means nothing is listening there.
 * When every port in the range is occupied that way, it's real exhaustion.
 */
async function probePorts(): Promise<{
  found: { port: number; roots: number } | null;
  occupiedByOther: number;
}> {
  const cached = getCachedPort();
  const ports: number[] = [];
  if (cached) ports.push(cached);
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_RANGE; p++) {
    if (p !== cached) ports.push(p);
  }

  let occupiedByOther = 0;
  for (const port of ports) {
    try {
      const res = await fetchWithTimeout(`${baseUrl(port)}/health`, { method: "GET" }, 700);
      if (!res.ok) {
        occupiedByOther++;
        continue;
      }
      const data = (await res.json().catch(() => null)) as { status?: string; roots?: number } | null;
      if (!data || data.status !== "ok") {
        occupiedByOther++;
        continue;
      }
      setCachedPort(port);
      return { found: { port, roots: data.roots ?? 0 }, occupiedByOther };
    } catch {
      // Connection refused / nothing listening on this port; not "occupied".
    }
  }
  return { found: null, occupiedByOther };
}

export async function discoverPort(): Promise<{ port: number; roots: number } | null> {
  const { found } = await probePorts();
  return found;
}

/** Health probe plus a token check, for the connection indicator. */
export async function checkStatus(): Promise<LocalAgentStatus> {
  const { found, occupiedByOther } = await probePorts();
  if (!found) {
    return occupiedByOther >= PORT_RANGE
      ? { state: "disconnected", portsExhausted: true }
      : { state: "disconnected" };
  }

  const token = getToken();
  if (!token) return { state: "unpaired", port: found.port };

  try {
    // /roots is authenticated and takes no params, so this is a clean 200/401
    // token check with no manufactured error status in the network log.
    const res = await fetchWithTimeout(
      `${baseUrl(found.port)}/roots`,
      { headers: { Authorization: `Bearer ${token}` } },
      1500
    );
    if (res.status === 401) return { state: "unpaired", port: found.port };
    return { state: "connected", port: found.port, roots: found.roots };
  } catch {
    return { state: "disconnected" };
  }
}

/** Maps a local agent HTTP status to the stable code callers branch on. */
function codeForStatus(status: number): FsErrorCode {
  switch (status) {
    case 401:
      return "unpaired";
    case 403:
      return "forbidden";
    case 404:
      return "not-found";
    case 413:
      return "too-large";
    default:
      return "unknown";
  }
}

/**
 * One authenticated GET against the local agent, with the failure modes mapped
 * onto `FsSourceError`. Everything that talks to the agent for structure (as
 * opposed to relayed tool calls) goes through here.
 */
async function agentGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new FsSourceError("unpaired", "local agent is not paired in this browser");
  }
  const found = await discoverPort();
  if (!found) {
    throw new FsSourceError("unpaired", "local agent is not running on this machine");
  }

  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl(found.port)}${endpoint}${qs ? `?${qs}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } },
      10_000
    );
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new FsSourceError(
      aborted ? "timeout" : "unknown",
      `could not reach the local agent: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    let message = `local agent returned HTTP ${res.status}`;
    if (body && typeof body === "object" && "error" in body) {
      message = String((body as { error: unknown }).error);
    }
    throw new FsSourceError(codeForStatus(res.status), message);
  }
  return body as T;
}

type ListResponse = { path: string; entries: { name: string; isDir: boolean }[] };

/** Directory listing from the user's machine, normalised for `FsSource`. */
export async function listDir(path: string): Promise<DirEntry[]> {
  const body = await agentGet<ListResponse>("/list", { path });
  return (body.entries ?? []).map((e) => ({
    name: e.name,
    type: e.isDir ? ("dir" as const) : ("file" as const),
  }));
}

/** File contents from the user's machine. */
export async function readFile(path: string): Promise<string> {
  const body = await agentGet<{ content: string }>("/read", { path });
  return body.content ?? "";
}

export function localAgentFsSource(): FsSource {
  return { list: listDir, read: readFile };
}

/** The allow-listed folders and their modes, for the permissions UI. */
export async function listRoots(): Promise<LocalProject[]> {
  const body = await agentGet<{ roots?: LocalProject[] }>("/roots", {});
  return (body.roots ?? []).map((r) => ({
    id: r.id,
    label: r.label || r.id,
    path: r.path,
    mode: r.mode === "rw" ? "rw" : "ro",
  }));
}

/**
 * The projects this machine offers. Authenticated, because the answer contains
 * absolute paths from the user's disk.
 */
export async function listProjects(): Promise<LocalProject[]> {
  const body = await agentGet<{ projects?: LocalProject[] }>("/projects", {});
  return (body.projects ?? []).map((p) => ({
    id: p.id,
    label: p.label || p.id,
    path: p.path,
    mode: p.mode === "rw" ? "rw" : "ro",
  }));
}

const OP_PATHS: Record<LocalFsOp, string> = {
  list: "/list",
  read: "/read",
  glob: "/glob",
  grep: "/grep",
  write: "/write",
  mkdir: "/mkdir",
};

export type LocalFsCallResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code?: FsErrorCode };

/** Runs one relayed tool call against the local agent. */
export async function runLocalFsRequest(
  op: LocalFsOp,
  params: Record<string, string>
): Promise<LocalFsCallResult> {
  const token = getToken();
  if (!token) {
    return { ok: false, error: "local agent is not paired in this browser" };
  }
  const found = await discoverPort();
  if (!found) {
    return { ok: false, error: "local agent is not running on this machine" };
  }

  // Write ops are POSTs with a JSON body: the agent rejects anything else, so
  // a cross-origin HTML form cannot reach them.
  const isWrite = WRITE_OPS.has(op);
  const qs = isWrite ? "" : `?${new URLSearchParams(params).toString()}`;
  const init: RequestInit = isWrite
    ? {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      }
    : { headers: { Authorization: `Bearer ${token}` } };

  try {
    const res = await fetchWithTimeout(`${baseUrl(found.port)}${OP_PATHS[op]}${qs}`, init, 20_000);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      let message = `local agent returned HTTP ${res.status}`;
      if (body && typeof body === "object" && "error" in body) {
        message = String((body as { error: unknown }).error);
      }
      // The code travels with the result so server-side scan logic can tell
      // "this folder is absent" from "the agent refused".
      return { ok: false, error: message, code: codeForStatus(res.status) };
    }
    return { ok: true, data: body };
  } catch (err) {
    return {
      ok: false,
      error: `could not reach the local agent: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Posts a relayed tool call's outcome back to the chat stream waiting on it. */
export async function postLocalFsResult(
  bridgeId: string,
  requestId: string,
  result: LocalFsCallResult
): Promise<void> {
  await fetch("/api/local-fs/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bridgeId,
      requestId,
      ok: result.ok,
      ...(result.ok ? { data: result.data } : { error: result.error, code: result.code }),
    }),
  }).catch(() => {
    // The stream may already be gone; the tool call times out server-side.
  });
}
