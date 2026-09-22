/**
 * Relay between the server-side MCP tools and the user's browser.
 *
 * The VPS cannot reach `localhost` on the user's machine, so a tool call is
 * pushed to the browser over the chat SSE stream; the browser calls the local
 * agent and POSTs the result back to /api/local-fs/result, which resolves the
 * promise the tool handler is awaiting here.
 *
 * State is per Node process and per in-flight chat request — nothing is
 * persisted, and a bridge dies with the stream that opened it.
 */

export type LocalFsOp = "read" | "glob" | "grep";

export type LocalFsRequest = {
  requestId: string;
  op: LocalFsOp;
  params: Record<string, string>;
};

export type LocalFsResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

type Pending = {
  resolve: (value: LocalFsResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Bridge = {
  onRequest: (req: LocalFsRequest) => void;
  pending: Map<string, Pending>;
};

const bridges = new Map<string, Bridge>();

/** How long a tool call waits for the browser before giving up. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Opens a bridge for one chat stream. The returned function closes it and
 * fails every still-pending call — always invoke it when the stream ends.
 */
export function openBridge(
  bridgeId: string,
  onRequest: (req: LocalFsRequest) => void
): () => void {
  const bridge: Bridge = { onRequest, pending: new Map() };
  bridges.set(bridgeId, bridge);

  return () => {
    for (const [, p] of bridge.pending) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: "chat stream closed before the local agent replied" });
    }
    bridge.pending.clear();
    bridges.delete(bridgeId);
  };
}

export function isBridgeOpen(bridgeId: string): boolean {
  return bridges.has(bridgeId);
}

/**
 * Called from an MCP tool handler: pushes the request to the browser and
 * waits for the result to come back through /api/local-fs/result.
 */
export function callLocalFs(
  bridgeId: string,
  op: LocalFsOp,
  params: Record<string, string>
): Promise<LocalFsResult> {
  const bridge = bridges.get(bridgeId);
  if (!bridge) {
    return Promise.resolve({
      ok: false,
      error: "local agent bridge is not connected for this session",
    });
  }

  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<LocalFsResult>((resolve) => {
    const timer = setTimeout(() => {
      bridge.pending.delete(requestId);
      resolve({
        ok: false,
        error: `local agent did not answer within ${REQUEST_TIMEOUT_MS / 1000}s`,
      });
    }, REQUEST_TIMEOUT_MS);

    bridge.pending.set(requestId, { resolve, timer });

    try {
      bridge.onRequest({ requestId, op, params });
    } catch (err) {
      clearTimeout(timer);
      bridge.pending.delete(requestId);
      resolve({
        ok: false,
        error: `could not reach the browser: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

/**
 * Called from the result route once the browser has talked to the local agent.
 * Returns false when the request is unknown (already timed out, or a bogus id).
 */
export function resolveLocalFsCall(
  bridgeId: string,
  requestId: string,
  result: LocalFsResult
): boolean {
  const bridge = bridges.get(bridgeId);
  const pending = bridge?.pending.get(requestId);
  if (!bridge || !pending) return false;

  clearTimeout(pending.timer);
  bridge.pending.delete(requestId);
  pending.resolve(result);
  return true;
}
