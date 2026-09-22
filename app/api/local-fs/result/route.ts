import { NextRequest } from "next/server";
import { resolveLocalFsCall, type LocalFsResult } from "@/lib/local-fs-bridge";

type ResultBody = {
  bridgeId: string;
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

/**
 * The browser posts here after calling the local agent, completing a tool call
 * that a chat stream is currently awaiting.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as ResultBody;

  if (!body?.bridgeId || !body?.requestId) {
    return new Response(JSON.stringify({ error: "bridgeId dan requestId wajib diisi" }), {
      status: 400,
    });
  }

  const result: LocalFsResult = body.ok
    ? { ok: true, data: body.data }
    : { ok: false, error: body.error || "local agent request failed" };

  const delivered = resolveLocalFsCall(body.bridgeId, body.requestId, result);
  if (!delivered) {
    // Timed out, or the stream is gone — nothing to fail the request over.
    return new Response(JSON.stringify({ delivered: false }), { status: 409 });
  }

  return new Response(JSON.stringify({ delivered: true }), { status: 200 });
}
