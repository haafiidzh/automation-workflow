import fs from "fs";
import { NextRequest } from "next/server";
import { getProjectById, getNotionAccounts, isWithinAllowedRoot } from "@/lib/registry";
import { scanProject } from "@/lib/claude-dir";
import { runAgentSession } from "@/lib/agent";

type ChatRequestBody = {
  projectId: string;
  agentName: string;
  notionAccountId: string;
  message: string;
  sessionId?: string;
};

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequestBody;
  const { projectId, agentName, notionAccountId, message, sessionId } = body;

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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const evt of runAgentSession({
          projectPath: project.path,
          agentName,
          docsFiles: scan.docsFiles,
          message,
          resumeSessionId: sessionId,
        })) {
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
