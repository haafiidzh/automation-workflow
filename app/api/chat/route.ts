import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { getProjectById, getNotionAccounts, isWithinAllowedRoot } from "@/lib/registry";
import { scanProject } from "@/lib/claude-dir";
import { runAgentSession, type AttachmentInput } from "@/lib/agent";
import { appendSessionTurn } from "@/lib/sessions";
import { getStorageDriver } from "@/lib/storage";
import type { AttachmentMeta, Disturbance, ResolvedDisturbance, SessionToolCall } from "@/lib/types";

type ChatRequestBody = {
  projectId: string;
  agentName: string;
  notionAccountId: string;
  message: string;
  sessionId?: string;
  /** Client-generated key attachments were uploaded under before a real (SDK) sessionId existed. */
  uploadSessionId?: string;
  attachments?: AttachmentMeta[];
  disturbances?: Disturbance[];
};

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequestBody;
  const { projectId, agentName, notionAccountId, message, sessionId, uploadSessionId, attachments, disturbances } =
    body;

  if (!projectId || !agentName || !notionAccountId || !message) {
    return new Response(
      JSON.stringify({ error: "projectId, agentName, notionAccountId, message wajib diisi" }),
      { status: 400 }
    );
  }

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

  const notionAccount = getNotionAccounts().find((n) => n.id === notionAccountId);
  if (!notionAccount) {
    return new Response(JSON.stringify({ error: "Akun Notion tidak ditemukan di registry" }), {
      status: 404,
    });
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

      let attachmentInputs: AttachmentInput[] | undefined;
      if (attachments?.length) {
        if (!storageSessionKey) {
          controller.enqueue(
            enc.encode(sseLine("error", { message: "uploadSessionId wajib diisi kalau ada attachments" }))
          );
          controller.close();
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
          controller.enqueue(
            enc.encode(
              sseLine("error", {
                message: `Gagal membaca lampiran: ${err instanceof Error ? err.message : String(err)}`,
              })
            )
          );
          controller.close();
          return;
        }
      }

      let resolvedDisturbances: ResolvedDisturbance[] | undefined;
      if (disturbances?.length) {
        resolvedDisturbances = disturbances.map((d) => {
          if (d.type === "note") return d;
          const docPath = path.join(project.path, ".claude", "docs", d.fileName);
          try {
            const content = fs.readFileSync(docPath, "utf-8");
            return { type: "doc" as const, fileName: d.fileName, content };
          } catch {
            return { type: "note" as const, text: `[doc not found: ${d.fileName}]` };
          }
        });
      }

      try {
        for await (const evt of runAgentSession({
          projectPath: project.path,
          agentName,
          docsFiles: scan.docsFiles,
          message,
          resumeSessionId: sessionId,
          notionToken: process.env[notionAccount.env],
          attachments: attachmentInputs,
          disturbances: resolvedDisturbances,
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
            sseLine("error", { message: err instanceof Error ? err.message : String(err) })
          )
        );
      } finally {
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
