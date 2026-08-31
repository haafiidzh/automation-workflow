import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readRulesContent } from "./claude-dir";
import { queryNotionDatabase } from "./notion";

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | {
      type: "result";
      sessionId: string;
      numTurns: number;
      isError: boolean;
      finalText: string;
    }
  | { type: "error"; message: string };

type RunSessionParams = {
  projectPath: string;
  agentName: string;
  docsFiles: string[];
  message: string;
  resumeSessionId?: string;
  notionToken?: string;
};

function buildSystemPromptAppend(docsFiles: string[], projectPath: string): string {
  const rules = readRulesContent(projectPath);
  const docsListing =
    docsFiles.length > 0
      ? `## File tersedia di .claude/docs/\n\n${docsFiles
          .map((f) => `- ${f}`)
          .join("\n")}\n\nBaca file yang relevan dengan tool Read sebelum menyusun brief.`
      : "## File tersedia di .claude/docs/\n\n(folder kosong)";

  const notionContract = `## Kontrak output untuk task Notion

Kalau brief ini ditujukan sebagai task/ticket Notion (biasanya karena kamu baca
NOTION_TASK_SCHEMA.md), sertakan SATU blok kode \`json\` di paling akhir respons,
setelah brief markdown biasa, dengan struktur persis:

\`\`\`json
{
  "notion_ticket": {
    "database_id": "<database ID dari NOTION_TASK_SCHEMA.md>",
    "properties": { "...": "object property Notion API asli, sesuai schema" },
    "content_markdown": "isi body ticket dalam markdown",
    "people_names": { "<person-id yang dipakai di properties>": "<nama orangnya>" }
  }
}
\`\`\`

\`properties\` harus sudah dalam bentuk value Notion API (mis. \`{"Name": {"title": [{"text": {"content": "..."}}]}}\`),
bukan pasangan key-value polos. Kalau brief ini bukan untuk Notion, jangan sertakan blok ini sama sekali.

\`people_names\` wajib diisi untuk SETIAP person-id yang muncul di \`properties\`
(properti type \`people\`) — ambil namanya dari NOTION_TASK_SCHEMA.md atau docs
known-people yang sudah kamu baca. Ini cuma buat ditampilkan di UI (bukan
dikirim ke Notion API), jadi user lihat nama, bukan id mentah. Kalau tidak ada
properti people sama sekali, boleh dihilangkan.

Kalau ada properti wajib (menurut tasking.md) yang TIDAK bisa kamu isi dengan aman
dari pesan user atau docs project — JANGAN menebak/mengarang nilainya, dan JANGAN
kirim \`notion_ticket\`. Sebagai gantinya, akhiri respons dengan blok \`json\` ini:

\`\`\`json
{
  "notion_ticket_needs_input": {
    "fields": [
      {
        "property": "<nama properti persis seperti di NOTION_TASK_SCHEMA.md>",
        "type": "people | select | date | text",
        "prompt": "pertanyaan singkat buat user",
        "options": [{ "id": "<id/value Notion API asli>", "label": "<label buat ditampilkan>" }]
      }
    ]
  }
}
\`\`\`

\`options\` wajib diisi untuk type \`people\`/\`select\` (ambil dari schema/known-people
yang sudah kamu baca), kosongkan/hilangkan untuk type \`date\`/\`text\`. Jawaban user
akan datang sebagai pesan berikutnya (format "<Property>: <value>" per baris) — pas
itu terjadi, evaluasi ulang: kalau masih ada yang kurang, kirim
\`notion_ticket_needs_input\` lagi (hanya untuk sisa yang belum terisi), kalau sudah
lengkap kirim \`notion_ticket\` final seperti kontrak di atas. Jangan pernah kirim
\`notion_ticket\` dan \`notion_ticket_needs_input\` sekaligus.`;

  return `${rules}\n\n---\n\n${docsListing}\n\n---\n\n${notionContract}`;
}

/**
 * Runs one turn of an agent session and yields streaming events.
 * Throws before any SDK call if .claude/rules/tasking.md is missing —
 * caller must surface this as a failed session, not fall back silently.
 */
export async function* runAgentSession({
  projectPath,
  agentName,
  docsFiles,
  message,
  resumeSessionId,
  notionToken,
}: RunSessionParams): AsyncGenerator<AgentEvent> {
  const append = buildSystemPromptAppend(docsFiles, projectPath);

  const allowedTools = ["Read", "Glob", "Grep"];
  const mcpServers: Record<string, ReturnType<typeof createSdkMcpServer>> = {};

  if (notionToken) {
    const queryDatabaseTool = tool(
      "query_database",
      "Query a Notion database read-only (e.g. to find the last used ticket number before creating a new one). Never use this to write data.",
      {
        database_id: z.string().describe("Notion database ID"),
        filter: z.unknown().optional().describe("Notion API filter object"),
        sorts: z.unknown().optional().describe("Notion API sorts array"),
        page_size: z.number().optional().describe("Max rows to return, default 20"),
      },
      async (args) => {
        const { results, hasMore } = await queryNotionDatabase(notionToken, args.database_id, {
          filter: args.filter,
          sorts: args.sorts,
          pageSize: args.page_size,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ results, hasMore }) }],
        };
      }
    );

    mcpServers.notion = createSdkMcpServer({
      name: "notion",
      version: "1.0.0",
      tools: [queryDatabaseTool],
    });
    allowedTools.push("mcp__notion__query_database");
  }

  const q = query({
    prompt: message,
    options: {
      cwd: projectPath,
      agent: agentName,
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code", append },
      allowedTools,
      mcpServers,
      maxTurns: 50,
      includePartialMessages: true,
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    },
  });

  let finalText = "";

  try {
    for await (const msg of q) {
      if (msg.type === "stream_event") {
        const event = msg.event;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text_delta", text: event.delta.text };
        }
        continue;
      }

      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "tool_use") {
            yield {
              type: "tool_call",
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }
          if (block.type === "text") {
            finalText = block.text;
          }
        }
        continue;
      }

      if (msg.type === "result") {
        if (msg.subtype === "success") {
          finalText = msg.result || finalText;
        }
        yield {
          type: "result",
          sessionId: msg.session_id,
          numTurns: msg.num_turns,
          isError: msg.is_error,
          finalText,
        };
        continue;
      }
    }
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
