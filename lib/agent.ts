import { query } from "@anthropic-ai/claude-agent-sdk";
import { readRulesContent } from "./claude-dir";

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
    "content_markdown": "isi body ticket dalam markdown"
  }
}
\`\`\`

\`properties\` harus sudah dalam bentuk value Notion API (mis. \`{"Name": {"title": [{"text": {"content": "..."}}]}}\`),
bukan pasangan key-value polos. Kalau brief ini bukan untuk Notion, jangan sertakan blok ini sama sekali.`;

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
}: RunSessionParams): AsyncGenerator<AgentEvent> {
  const append = buildSystemPromptAppend(docsFiles, projectPath);

  const q = query({
    prompt: message,
    options: {
      cwd: projectPath,
      agent: agentName,
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code", append },
      allowedTools: ["Read", "Glob", "Grep"],
      maxTurns: 12,
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
