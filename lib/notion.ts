import { markdownToBlocks } from "@tryfabric/martian";
import type { NotionTicket } from "./notion-ticket";

export type { NotionTicket } from "./notion-ticket";
export { parseNotionTicket, stripNotionTicketBlock } from "./notion-ticket";

const NOTION_API_VERSION = "2022-06-28";

/**
 * Creates a page in the given Notion database. Throws with the Notion
 * API's own error message on failure — caller surfaces it as-is.
 */
export async function createNotionPage(
  token: string,
  ticket: NotionTicket
): Promise<{ url: string }> {
  const children = markdownToBlocks(ticket.content_markdown);

  const res = await fetch("https://api.notion.com/v1/pages", {
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
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Notion API error (${res.status})`);
  }

  return { url: data.url as string };
}
