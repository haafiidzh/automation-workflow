import { markdownToBlocks } from "@tryfabric/martian";
import type { NotionTicket } from "./notion-ticket";

export type { NotionTicket } from "./notion-ticket";
export { parseNotionTickets, stripNotionTicketBlock } from "./notion-ticket";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Read-only query against a Notion database, exposed to the agent as a
 * custom SDK tool so it can check things like "last used ticket number"
 * without needing the ticket-creation token flow.
 */
export async function queryNotionDatabase(
  token: string,
  databaseId: string,
  opts: { filter?: unknown; sorts?: unknown; pageSize?: number } = {}
): Promise<{ results: unknown[]; hasMore: boolean }> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: opts.filter,
        sorts: opts.sorts,
        page_size: opts.pageSize ?? 20,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Notion API error (${res.status})`);
  }

  return { results: data.results ?? [], hasMore: Boolean(data.has_more) };
}

export type NotionFileAttachment = {
  buffer: Buffer;
  filename: string;
  mime: string;
  kind: "image" | "pdf" | "excel";
};

/**
 * Uploads a file's bytes to Notion via the two-step File Upload API
 * (create the upload object, then send its content) and returns the
 * resulting file_upload id, ready to reference from a block/property.
 */
export async function uploadFileToNotion(
  token: string,
  file: NotionFileAttachment
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_API_VERSION,
  };

  let createRes: Response;
  try {
    createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.filename, content_type: file.mime }),
      signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Notion API tidak merespons dalam ${NOTION_REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  const created = await createRes.json();
  if (!createRes.ok) {
    throw new Error(created.message || `Notion file upload error (${createRes.status})`);
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mime }), file.filename);

  let sendRes: Response;
  try {
    sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${created.id}/send`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Notion API tidak merespons dalam ${NOTION_REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  const sent = await sendRes.json();
  if (!sendRes.ok) {
    throw new Error(sent.message || `Notion file upload error (${sendRes.status})`);
  }

  return created.id as string;
}

/**
 * Creates a page in the given Notion database. Throws with the Notion
 * API's own error message on failure — caller surfaces it as-is.
 * Image attachments are uploaded first via the File Upload API and
 * appended as image blocks after the markdown-derived content.
 */
export async function createNotionPage(
  token: string,
  ticket: NotionTicket,
  attachments: NotionFileAttachment[] = []
): Promise<{ url: string }> {
  const children = markdownToBlocks(ticket.content_markdown);

  for (const file of attachments) {
    const fileUploadId = await uploadFileToNotion(token, file);
    const blockType = file.kind === "image" ? "image" : file.kind === "pdf" ? "pdf" : "file";
    children.push({
      object: "block",
      type: blockType,
      [blockType]: { type: "file_upload", file_upload: { id: fileUploadId } },
    } as unknown as (typeof children)[number]);
  }

  let res: Response;
  try {
    res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: ticket.database_id },
        properties: ticket.properties,
        children,
      }),
      signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Notion API tidak merespons dalam ${NOTION_REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Notion API error (${res.status})`);
  }

  return { url: data.url as string };
}
