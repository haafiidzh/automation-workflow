/**
 * Browser-side client for the local agent (see `local-agent/`).
 *
 * The VPS cannot reach the user's machine, so every call to the agent happens
 * here, in the tab, and the result is posted back to the server over
 * /api/local-fs/result.
 */

import type { LocalFsOp } from "./local-fs-bridge";

export const DEFAULT_PORT = 47821;
/** The agent walks this range when its default port is taken. */
export const PORT_RANGE = 10;

const TOKEN_KEY = "orchestrator.localAgent.token";
const PORT_KEY = "orchestrator.localAgent.port";

export type LocalAgentStatus =
  | { state: "disconnected" }
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
 */
export async function discoverPort(): Promise<{ port: number; roots: number } | null> {
  const cached = getCachedPort();
  const ports: number[] = [];
  if (cached) ports.push(cached);
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_RANGE; p++) {
    if (p !== cached) ports.push(p);
  }

  for (const port of ports) {
    try {
      const res = await fetchWithTimeout(`${baseUrl(port)}/health`, { method: "GET" }, 700);
      if (!res.ok) continue;
      const data = (await res.json()) as { status?: string; roots?: number };
      if (data.status !== "ok") continue;
      setCachedPort(port);
      return { port, roots: data.roots ?? 0 };
    } catch {
      // Not listening on this port (or blocked); try the next one.
    }
  }
  return null;
}

/** Health probe plus a token check, for the connection indicator. */
export async function checkStatus(): Promise<LocalAgentStatus> {
  const found = await discoverPort();
  if (!found) return { state: "disconnected" };

  const token = getToken();
  if (!token) return { state: "unpaired", port: found.port };

  try {
    // /list against a bogus path still tells us whether the token is accepted:
    // 401 means unpaired, anything else means the token is good.
    const res = await fetchWithTimeout(
      `${baseUrl(found.port)}/list?path=`,
      { headers: { Authorization: `Bearer ${token}` } },
      1500
    );
    if (res.status === 401) return { state: "unpaired", port: found.port };
    return { state: "connected", port: found.port, roots: found.roots };
  } catch {
    return { state: "disconnected" };
  }
}

const OP_PATHS: Record<LocalFsOp, string> = {
  read: "/read",
  glob: "/glob",
  grep: "/grep",
};

export type LocalFsCallResult = { ok: true; data: unknown } | { ok: false; error: string };

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

  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetchWithTimeout(
      `${baseUrl(found.port)}${OP_PATHS[op]}?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } },
      20_000
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (body && typeof body === "object" && "error" in body && String(body.error)) ||
        `local agent returned HTTP ${res.status}`;
      return { ok: false, error: message };
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
      ...(result.ok ? { data: result.data } : { error: result.error }),
    }),
  }).catch(() => {
    // The stream may already be gone; the tool call times out server-side.
  });
}
