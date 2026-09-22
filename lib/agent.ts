import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readRulesContent } from "./claude-dir";
import { queryNotionDatabase } from "./notion";
import { parseExcelToText } from "./excel-parse";
import { callLocalFs } from "./local-fs-bridge";
import type { AttachmentMeta, ResolvedDisturbance } from "./types";

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

export type AttachmentInput = AttachmentMeta & { data: Buffer };

type RunSessionParams = {
  projectPath: string;
  agentName: string;
  docsFiles: string[];
  message: string;
  resumeSessionId?: string;
  notionToken?: string;
  attachments?: AttachmentInput[];
  disturbances?: ResolvedDisturbance[];
  /**
   * When set, filesystem reads are proxied to the local agent running on the
   * user's machine (through the browser) instead of the native SDK tools,
   * which would only ever see the server's own disk.
   */
  localFsBridgeId?: string;
};

const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Builds a text prefix from resolved disturbances (notes + doc contents)
 * that gets prepended to the user message.
 */
function buildDisturbancePrefix(disturbances: ResolvedDisturbance[]): string {
  const notes = disturbances.filter((d) => d.type === "note");
  const docs = disturbances.filter((d) => d.type === "doc");

  if (notes.length === 0 && docs.length === 0) return "";

  const parts: string[] = ["## Additional context (disturb)\n"];

  if (notes.length > 0) {
    parts.push("### Notes");
    for (const n of notes) {
      parts.push(`- ${n.text}`);
    }
    parts.push("");
  }

  if (docs.length > 0) {
    for (const d of docs) {
      parts.push(`### Doc: ${d.fileName}\n${d.content}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Builds the SDK prompt for one turn. Plain string when there are no
 * attachments (keeps the common path simple); an async-iterable of one
 * SDKUserMessage with content blocks when there are — images and PDFs go in
 * natively, Excel gets flattened to text first (SDK has no xlsx block type).
 */
async function buildPrompt(
  message: string,
  attachments: AttachmentInput[] | undefined,
  disturbancePrefix: string
): Promise<string | AsyncIterable<SDKUserMessage>> {
  const fullMessage = disturbancePrefix ? `${disturbancePrefix}\n---\n\n${message}` : message;
  if (!attachments || attachments.length === 0) return fullMessage;

  const blocks: Array<Record<string, unknown>> = [];

  for (const att of attachments) {
    if (att.kind === "image" && IMAGE_MEDIA_TYPES.has(att.mime)) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mime, data: att.data.toString("base64") },
      });
    } else if (att.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: att.data.toString("base64") },
      });
    } else if (att.kind === "excel") {
      const text = await parseExcelToText(att.data);
      blocks.push({ type: "text", text: `## Lampiran Excel: ${att.name}\n\n${text}` });
    }
  }

  blocks.push({ type: "text", text: fullMessage });

  const sdkMessage: SDKUserMessage = {
    type: "user",
    message: { role: "user", content: blocks as never },
    parent_tool_use_id: null,
  };

  return (async function* () {
    yield sdkMessage;
  })();
}

function buildSystemPromptAppend(
  docsFiles: string[],
  projectPath: string,
  localFsEnabled = false
): string {
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
  "notion_tickets": [
    {
      "database_id": "<database ID dari NOTION_TASK_SCHEMA.md>",
      "properties": { "...": "object property Notion API asli, sesuai schema" },
      "content_markdown": "isi body ticket dalam markdown",
      "people_names": { "<person-id yang dipakai di properties>": "<nama orangnya>" }
    }
  ]
}
\`\`\`

\`notion_tickets\` array — satu entry per ticket. Kalau pesan user minta beberapa
task sekaligus (mis. task backend + task mobile terpisah), buat satu entry per
task dalam array yang sama, JANGAN kirim beberapa blok \`json\` terpisah dan
JANGAN gabungkan beberapa task jadi satu entry. Urutan entry bebas ikut urutan
disebut di pesan user.

\`properties\` tiap entry harus sudah dalam bentuk value Notion API (mis. \`{"Name": {"title": [{"text": {"content": "..."}}]}}\`),
bukan pasangan key-value polos. Kalau brief ini bukan untuk Notion, jangan sertakan blok ini sama sekali.

\`people_names\` tiap entry wajib diisi untuk SETIAP person-id yang muncul di
\`properties\` entry itu (properti type \`people\`) — ambil namanya dari
NOTION_TASK_SCHEMA.md atau docs known-people yang sudah kamu baca. Ini cuma buat
ditampilkan di UI (bukan dikirim ke Notion API), jadi user lihat nama, bukan id
mentah. Kalau tidak ada properti people sama sekali di entry itu, boleh
dihilangkan.

Kalau ada properti wajib (menurut tasking.md) yang TIDAK bisa kamu isi dengan aman
dari pesan user atau docs project — untuk SALAH SATU ticket pun — JANGAN
menebak/mengarang nilainya, dan JANGAN kirim \`notion_tickets\` sama sekali untuk
semua ticket dalam batch ini.

Begitu juga kalau, pas menyusun brief/ticket, kamu nemu **open question** (hal
yang ambigu/belum jelas dari pesan user) atau **risk** (potensi masalah yang
user perlu tahu/putuskan) — JANGAN diam-diam memutuskan sendiri dan JANGAN
selipin asumsi kamu langsung ke \`content_markdown\` tanpa persetujuan user.
Perlakukan ini sama seperti properti wajib yang kurang: tahan \`notion_tickets\`,
dan tanyakan dulu ke user satu per satu lewat kontrak di bawah.

Akhiri respons dengan blok \`json\` ini yang mencakup SEMUA hal yang perlu
ditanyakan (field kurang + open question + risk) dari SEMUA ticket yang diminta:

\`\`\`json
{
  "notion_ticket_needs_input": {
    "fields": [
      {
        "ticket": "<label singkat buat bedain ticket ini dari ticket lain di batch yang sama, mis. 'Backend - Arfan'; kosongkan/hilangkan kalau cuma 1 ticket>",
        "property": "<nama properti Notion persis seperti di NOTION_TASK_SCHEMA.md kalau kind='field'; kalau kind='question'/'risk', isi label singkat buat pertanyaan itu, mis. 'Risk: rate limit API'>",
        "type": "people | select | date | text | confirm",
        "kind": "field | question | risk",
        "prompt": "pertanyaan singkat buat user",
        "options": [{ "id": "<id/value Notion API asli>", "label": "<label buat ditampilkan>" }]
      }
    ]
  }
}
\`\`\`

\`kind\` default ke \`field\` kalau dihilangkan (buat properti wajib yang kurang).
Pakai \`kind: "question"\` buat open question, \`kind: "risk"\` buat risk. Untuk
\`question\`/\`risk\`, biasanya pakai \`type: "confirm"\` (user tinggal pilih
sertakan/abaikan) atau \`type: "text"\` kalau butuh jawaban bebas dari user —
JANGAN pakai \`type: "people"/"select"/"date"\` untuk kind ini karena bukan
properti Notion asli. \`options\` wajib diisi untuk type \`people\`/\`select\`
(ambil dari schema/known-people yang sudah kamu baca), kosongkan/hilangkan
untuk type lain.

Field-field ini ditanyakan ke user SATU PER SATU (bukan sekaligus) di UI —
kamu cukup kirim semuanya dalam satu array \`fields\`, urutan tampil ikut
urutan array. Jawaban user akan datang sebagai pesan berikutnya (format
"<Property>: <value>" per baris, atau "<Ticket> / <Property>: <value>" kalau
field-nya kamu tandai per ticket) — pas itu terjadi, evaluasi ulang: kalau
masih ada yang kurang/perlu ditanya, kirim \`notion_ticket_needs_input\` lagi
(hanya untuk sisa yang belum terjawab), kalau sudah lengkap kirim
\`notion_tickets\` final (array lengkap semua ticket di batch ini, dengan
keputusan user soal open question/risk sudah dipertimbangkan) seperti kontrak
di atas. Jangan pernah kirim \`notion_tickets\` dan \`notion_ticket_needs_input\`
sekaligus.

Jawaban user buat \`kind: "question"\`/\`"risk"\` WAJIB masuk ke \`content_markdown\`
(mis. section "Open Questions" / "Risks" di body ticket), BUKAN ke \`properties\`.
Jangan pernah tulis jawaban question/risk sebagai value properti Notion apa pun
(termasuk properti free-text seperti Notes) — properti Notion cuma buat field
asli sesuai NOTION_TASK_SCHEMA.md.`;

  const localFs = localFsEnabled
    ? `## Akses file lokal user

File di mesin user TIDAK bisa dibaca dengan tool Read/Glob/Grep bawaan —
tool itu tidak tersedia di sesi ini. Pakai tool berikut, yang jalan lewat
local agent di mesin user:

- \`mcp__local_fs__read_file\` — baca satu file (butuh path absolut).
- \`mcp__local_fs__glob\` — cari file dengan pola glob di dalam satu folder.
- \`mcp__local_fs__grep\` — cari baris yang cocok regex di dalam satu folder.

Folder yang boleh diakses dibatasi allow-list di local agent user. Kalau tool
balas error "outside the allow-listed folders" atau "not connected", sampaikan
ke user untuk menambahkan folder / menyambungkan local agent — jangan menebak
isi file.`
    : "";

  return [rules, docsListing, notionContract, localFs]
    .filter((part) => part.trim().length > 0)
    .join("\n\n---\n\n");
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
  attachments,
  disturbances,
  localFsBridgeId,
}: RunSessionParams): AsyncGenerator<AgentEvent> {
  const append = buildSystemPromptAppend(docsFiles, projectPath, Boolean(localFsBridgeId));
  const disturbancePrefix = disturbances?.length ? buildDisturbancePrefix(disturbances) : "";
  const prompt = await buildPrompt(message, attachments, disturbancePrefix);

  // Without a bridge the SDK's own tools read the machine this process runs
  // on, which is right for a locally-run Orchestrator. With a bridge, the
  // user's own filesystem is served over it instead.
  const allowedTools = localFsBridgeId ? [] : ["Read", "Glob", "Grep"];
  const mcpServers: Record<string, ReturnType<typeof createSdkMcpServer>> = {};

  if (localFsBridgeId) {
    const bridgeId = localFsBridgeId;

    const asToolResult = (result: Awaited<ReturnType<typeof callLocalFs>>) => ({
      content: [
        {
          type: "text" as const,
          text: result.ok ? JSON.stringify(result.data) : `Error: ${result.error}`,
        },
      ],
      ...(result.ok ? {} : { isError: true }),
    });

    const readFileTool = tool(
      "read_file",
      "Read a text file from the user's local machine. Use an absolute path inside a folder the user allow-listed in their local agent.",
      {
        path: z.string().describe("Absolute path of the file on the user's machine"),
      },
      async (args) => asToolResult(await callLocalFs(bridgeId, "read", { path: args.path }))
    );

    const globTool = tool(
      "glob",
      "List files on the user's local machine matching a glob pattern (supports ** for nested folders), relative to cwd.",
      {
        pattern: z.string().describe("Glob pattern, e.g. **/*.ts"),
        cwd: z.string().describe("Absolute folder to search in, on the user's machine"),
      },
      async (args) =>
        asToolResult(await callLocalFs(bridgeId, "glob", { pattern: args.pattern, cwd: args.cwd }))
    );

    const grepTool = tool(
      "grep",
      "Search file contents on the user's local machine with a regular expression; returns file path, line number and the matching line.",
      {
        pattern: z.string().describe("Regular expression (Go/RE2 syntax)"),
        cwd: z.string().describe("Absolute folder to search in, on the user's machine"),
        glob: z.string().optional().describe("Optional glob to limit which files are searched"),
      },
      async (args) =>
        asToolResult(
          await callLocalFs(bridgeId, "grep", {
            pattern: args.pattern,
            cwd: args.cwd,
            ...(args.glob ? { glob: args.glob } : {}),
          })
        )
    );

    mcpServers.local_fs = createSdkMcpServer({
      name: "local_fs",
      version: "1.0.0",
      tools: [readFileTool, globTool, grepTool],
    });
    allowedTools.push(
      "mcp__local_fs__read_file",
      "mcp__local_fs__glob",
      "mcp__local_fs__grep"
    );
  }

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
    prompt,
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
