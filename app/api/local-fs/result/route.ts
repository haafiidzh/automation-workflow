import { NextRequest } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { getBridgeOwner, resolveLocalFsCall, type LocalFsResult } from "@/lib/local-fs-bridge";
import type { FsErrorCode } from "@/lib/fs-source";

type ResultBody = {
  bridgeId: string;
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: FsErrorCode;
};

/**
 * The browser posts here after calling the local agent, completing a tool call
 * that a chat stream is currently awaiting.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = (await req.json()) as ResultBody;

  if (!body?.bridgeId || !body?.requestId) {
    return new Response(JSON.stringify({ error: "bridgeId dan requestId wajib diisi" }), {
      status: 400,
    });
  }

  // A bridge belonging to someone else must look exactly like one that does
  // not exist — a distinct status would confirm the id is real.
  if (getBridgeOwner(body.bridgeId) !== user.id) {
    return new Response(JSON.stringify({ error: "bridge tidak ditemukan" }), { status: 404 });
  }

  const result: LocalFsResult = body.ok
    ? { ok: true, data: body.data }
    : { ok: false, error: body.error || "local agent request failed", code: body.code };

  const delivered = resolveLocalFsCall(body.bridgeId, body.requestId, result);
  if (!delivered) {
    // Timed out, or the stream is gone — nothing to fail the request over.
    return new Response(JSON.stringify({ delivered: false }), { status: 409 });
  }

  return new Response(JSON.stringify({ delivered: true }), { status: 200 });
}
