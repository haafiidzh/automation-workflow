import fs from "fs";
import { NextRequest } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { getProjectById, getNotionAccounts, isWithinAllowedRoot } from "@/lib/registry";
import { nodeFsSource, scanProject } from "@/lib/claude-dir";
import {
  getAgentDefinition,
  readRulesFromInput,
  scanProjectFromInput,
} from "@/lib/project-scan";
import { collectScanInput, joinPath, type FsSource } from "@/lib/fs-source";
import { runAgentSession, type AttachmentInput } from "@/lib/agent";
import { appendSessionTurn, getSessionOwner } from "@/lib/sessions";
import { getStorageDriver } from "@/lib/storage";
import { bridgeFsSource, openBridge } from "@/lib/local-fs-bridge";
import type { AttachmentMeta, Disturbance, ResolvedDisturbance, SessionToolCall } from "@/lib/types";

type ChatRequestBody = {
  projectId: string;
  /**
   * Absolute path on the user's machine. Only meaningful together with
   * `localFsBridgeId`: those projects come from the local agent, so this server
   * has no registry row to look the path up in.
   */
  projectPath?: string;
  agentName: string;
  notionAccountId: string;
  message: string;
  sessionId?: string;
  /** Client-generated key attachments were uploaded under before a real (SDK) sessionId existed. */
  uploadSessionId?: string;
  attachments?: AttachmentMeta[];
  disturbances?: Disturbance[];
  /** Set by the browser when a paired local agent should serve file reads. */
  localFsBridgeId?: string;
};

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  // Auth is checked before the ReadableStream is built so a rejection is a
  // plain HTTP 401 the client can handle, not an SSE error event.
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = (await req.json()) as ChatRequestBody;
  const {
    projectId,
    projectPath,
    agentName,
    notionAccountId,
    message,
    sessionId,
    uploadSessionId,
    attachments,
    disturbances,
    localFsBridgeId,
  } = body;

  if (!projectId || !agentName || !notionAccountId || !message) {
    return new Response(
      JSON.stringify({ error: "projectId, agentName, notionAccountId, message wajib diisi" }),
      { status: 400 }
    );
  }

  // Scoped to the caller: without this, any logged-in user could spend another
  // user's Notion token just by guessing their account id.
  const notionAccount = getNotionAccounts(user.id).find((n) => n.id === notionAccountId);
  if (!notionAccount) {
    return new Response(JSON.stringify({ error: "Akun Notion tidak ditemukan di registry" }), {
      status: 403,
    });
  }

  // Resuming someone else's chat would hand over its whole history.
  if (sessionId && getSessionOwner(sessionId) !== user.id) {
    return new Response(JSON.stringify({ error: "Session tidak ditemukan" }), { status: 404 });
  }

  /**
   * With a bridge open, the project lives on the user's machine: the server's
   * registry and ALLOWED_PROJECT_ROOT describe a different disk entirely, and
   * the allow-list that matters is the local agent's own. Validation moves
   * inside the stream, where the bridge exists.
   *
   * Without a bridge, nothing changes: the project is on this machine and is
   * validated here, before a single byte of the stream is written.
   */
  let resolvedPath: string;
  let serverDocsFiles: string[] = [];

  if (localFsBridgeId) {
    if (!projectPath) {
      return new Response(
        JSON.stringify({ error: "projectPath wajib diisi saat local agent aktif" }),
        { status: 400 }
      );
    }
    resolvedPath = projectPath;
  } else {
    const project = getProjectById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project tidak ditemukan di registry" }), {
        status: 404,
      });
    }

    if (
      !fs.existsSync(project.path) ||
      !fs.statSync(project.path).isDirectory() ||
      !isWithinAllowedRoot(project.path)
    ) {
      return new Response(
        JSON.stringify({ error: "Path project tidak valid atau di luar ALLOWED_PROJECT_ROOT" }),
        { status: 403 }
      );
    }

    const scan = scanProject(project.path);
    if (!scan.validation.valid) {
      return new Response(
        JSON.stringify({ error: `Project belum lengkap: ${scan.validation.missing.join(", ")}` }),
        { status: 400 }
      );
    }

    if (!scan.agents.some((a) => a.name === agentName)) {
      return new Response(
        JSON.stringify({ error: `Agent "${agentName}" tidak ditemukan di .claude/agents/ project ini` }),
        { status: 400 }
      );
    }

    resolvedPath = project.path;
    serverDocsFiles = scan.docsFiles;
  }

  // Attachments were uploaded keyed by the SDK sessionId once it exists, or by
  // a client-generated draft id for a brand-new chat (before the SDK has
  // assigned one). Either way, that's the storage key we read them back from.
  const storageSessionKey = sessionId ?? uploadSessionId;
  const storage = getStorageDriver();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const turnStartedAt = new Date().toISOString();
      let assistantText = "";
      const toolCalls: SessionToolCall[] = [];

      // Filesystem tool calls are relayed to the browser over this same
      // stream; the browser answers on /api/local-fs/result.
      let closeBridge: (() => void) | undefined;
      if (localFsBridgeId) {
        closeBridge = openBridge(localFsBridgeId, user.id, (bridgeReq) => {
          controller.enqueue(enc.encode(sseLine("local_fs_request", {
            type: "local_fs_request",
            ...bridgeReq,
          })));
        });
      }

      const fail = (msg: string) => {
        controller.enqueue(enc.encode(sseLine("error", { type: "error", message: msg })));
        closeBridge?.();
        controller.close();
      };

      // The bridge only exists inside this stream, so a project on the user's
      // machine can only be validated from here.
      const src: FsSource = localFsBridgeId ? bridgeFsSource(localFsBridgeId) : nodeFsSource();
      let docsFiles = serverDocsFiles;
      let rules: string | undefined;
      let agentDefinition: { description: string; prompt: string } | undefined;

      if (localFsBridgeId) {
        try {
          // One traversal answers all three questions — validity, the agent
          // definition and the rules — so the bridge is not walked three times.
          const input = await collectScanInput(src, resolvedPath);
          const scan = scanProjectFromInput(input);
          if (!scan.validation.valid) {
            fail(`Project belum lengkap: ${scan.validation.missing.join(", ")}`);
            return;
          }
          const definition = getAgentDefinition(input, agentName);
          if (!definition) {
            fail(`Agent "${agentName}" tidak ditemukan di .claude/agents/ project ini`);
            return;
          }
          docsFiles = scan.docsFiles;
          agentDefinition = definition;
          rules = readRulesFromInput(input);
        } catch (err) {
          fail(
            `Gagal membaca project dari local agent: ${err instanceof Error ? err.message : String(err)}`
          );
          return;
        }
      }

      let attachmentInputs: AttachmentInput[] | undefined;
      if (attachments?.length) {
        if (!storageSessionKey) {
          fail("uploadSessionId wajib diisi kalau ada attachments");
          return;
        }
        try {
          attachmentInputs = await Promise.all(
            attachments.map(async (att) => ({
              ...att,
              data: await storage.read(storageSessionKey, att.fileId),
            }))
          );
        } catch (err) {
          fail(`Gagal membaca lampiran: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }

      let resolvedDisturbances: ResolvedDisturbance[] | undefined;
      if (disturbances?.length) {
        resolvedDisturbances = await Promise.all(
          disturbances.map(async (d): Promise<ResolvedDisturbance> => {
            if (d.type === "note") return d;
            const docPath = joinPath(resolvedPath, ".claude", "docs", d.fileName);
            try {
              return { type: "doc", fileName: d.fileName, content: await src.read(docPath) };
            } catch {
              return { type: "note", text: `[doc not found: ${d.fileName}]` };
            }
          })
        );
      }

      try {
        for await (const evt of runAgentSession({
          projectPath: resolvedPath,
          agentName,
          docsFiles,
          message,
          resumeSessionId: sessionId,
          notionToken: process.env[notionAccount.env],
          attachments: attachmentInputs,
          disturbances: resolvedDisturbances,
          localFsBridgeId,
          rules,
          agentDefinition,
        })) {
          if (evt.type === "text_delta") {
            assistantText += evt.text;
          } else if (evt.type === "tool_call") {
            toolCalls.push({ name: evt.name, input: evt.input });
          } else if (evt.type === "result") {
            // Keep storage keyed by the real session id from here on.
            if (storageSessionKey && storageSessionKey !== evt.sessionId) {
              try {
                await storage.renameSession(storageSessionKey, evt.sessionId);
              } catch (renameErr) {
                console.error("Failed to move attachment storage to session id:", renameErr);
              }
            }
            try {
              appendSessionTurn({
                sessionId: evt.sessionId,
                userId: user.id,
                projectId,
                agentName,
                notionAccountId,
                userTurn: {
                  role: "user",
                  text: message,
                  timestamp: turnStartedAt,
                  attachments: attachments?.length ? attachments : undefined,
                },
                assistantTurn: {
                  role: "assistant",
                  text: evt.finalText || assistantText,
                  toolCalls: toolCalls.length ? toolCalls : undefined,
                  timestamp: new Date().toISOString(),
                },
                numTurns: evt.numTurns,
                isError: evt.isError,
              });
            } catch (saveErr) {
              console.error("Failed to save session:", saveErr);
            }
          }
          controller.enqueue(enc.encode(sseLine(evt.type, evt)));
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(
            sseLine("error", {
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            })
          )
        );
      } finally {
        closeBridge?.();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
