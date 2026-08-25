export type NotionTicket = {
  database_id: string;
  properties: Record<string, unknown>;
  content_markdown: string;
};

/**
 * Extracts the last ```json ... ``` fenced block from agent output and
 * parses it as a { notion_ticket: NotionTicket } payload. Returns null if
 * no block is present or it doesn't match the expected shape — the agent
 * only emits this block when the brief targets Notion.
 */
export function parseNotionTicket(text: string): NotionTicket | null {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (matches.length === 0) return null;

  const raw = matches[matches.length - 1][1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("notion_ticket" in parsed)
  ) {
    return null;
  }

  const ticket = (parsed as { notion_ticket: unknown }).notion_ticket;
  if (
    typeof ticket !== "object" ||
    ticket === null ||
    typeof (ticket as NotionTicket).database_id !== "string" ||
    typeof (ticket as NotionTicket).properties !== "object" ||
    typeof (ticket as NotionTicket).content_markdown !== "string"
  ) {
    return null;
  }

  return ticket as NotionTicket;
}

export function stripNotionTicketBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```\s*$/, "").trimEnd();
}

function richTextToString(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.plain_text === "string") return o.plain_text;
        const text = o.text as Record<string, unknown> | undefined;
        if (text && typeof text.content === "string") return text.content;
      }
      return "";
    })
    .join("");
}

/** Finds the page title from a Notion "title"-type property value. */
export function extractNotionTitle(properties: Record<string, unknown>): string {
  for (const value of Object.values(properties)) {
    if (value && typeof value === "object" && "title" in (value as object)) {
      const s = richTextToString((value as Record<string, unknown>).title);
      if (s) return s;
    }
  }
  return "";
}

export type NotionPropertyDisplay = {
  name: string;
  value: string;
  empty: boolean;
  type: string;
  checked?: boolean;
};

/**
 * Turns a raw Notion API `properties` payload (the shape sent to
 * POST /v1/pages) into a flat list ready for display — one entry per
 * property, title excluded since it's rendered separately as the page title.
 */
export function formatNotionProperties(properties: Record<string, unknown>): NotionPropertyDisplay[] {
  return Object.entries(properties)
    .filter(([, v]) => !(v && typeof v === "object" && "title" in (v as object)))
    .map(([name, v]) => {
      if (!v || typeof v !== "object") return { name, value: "", empty: true, type: "unknown" };
      const o = v as Record<string, unknown>;

      if ("rich_text" in o) {
        const s = richTextToString(o.rich_text);
        return { name, value: s, empty: !s, type: "rich_text" };
      }
      if ("select" in o) {
        const sel = o.select as Record<string, unknown> | null;
        const s = sel && typeof sel.name === "string" ? sel.name : "";
        return { name, value: s, empty: !s, type: "select" };
      }
      if ("status" in o) {
        const st = o.status as Record<string, unknown> | null;
        const s = st && typeof st.name === "string" ? st.name : "";
        return { name, value: s, empty: !s, type: "status" };
      }
      if ("multi_select" in o) {
        const arr = Array.isArray(o.multi_select) ? o.multi_select : [];
        const names = arr
          .map((x) => (x && typeof x === "object" && typeof (x as Record<string, unknown>).name === "string"
            ? ((x as Record<string, unknown>).name as string)
            : ""))
          .filter(Boolean);
        return { name, value: names.join(", "), empty: names.length === 0, type: "multi_select" };
      }
      if ("people" in o) {
        const arr = Array.isArray(o.people) ? o.people : [];
        const names = arr
          .map((x) => {
            if (x && typeof x === "object") {
              const p = x as Record<string, unknown>;
              if (typeof p.name === "string") return p.name;
              if (typeof p.id === "string") return p.id;
            }
            return "";
          })
          .filter(Boolean);
        return { name, value: names.join(", "), empty: names.length === 0, type: "people" };
      }
      if ("date" in o) {
        const d = o.date as Record<string, unknown> | null;
        const s =
          d && typeof d.start === "string"
            ? d.start + (typeof d.end === "string" ? ` → ${d.end}` : "")
            : "";
        return { name, value: s, empty: !s, type: "date" };
      }
      if ("checkbox" in o) {
        return { name, value: "", empty: false, type: "checkbox", checked: Boolean(o.checkbox) };
      }
      if ("number" in o) {
        const n = o.number;
        return { name, value: typeof n === "number" ? String(n) : "", empty: n === null || n === undefined, type: "number" };
      }
      if ("url" in o) {
        const s = typeof o.url === "string" ? o.url : "";
        return { name, value: s, empty: !s, type: "url" };
      }
      if ("email" in o) {
        const s = typeof o.email === "string" ? o.email : "";
        return { name, value: s, empty: !s, type: "email" };
      }
      if ("phone_number" in o) {
        const s = typeof o.phone_number === "string" ? o.phone_number : "";
        return { name, value: s, empty: !s, type: "phone_number" };
      }
      if ("relation" in o) {
        const arr = Array.isArray(o.relation) ? o.relation : [];
        return { name, value: String(arr.length), empty: arr.length === 0, type: "relation" };
      }
      return { name, value: "", empty: true, type: "unknown" };
    });
}

/**
 * Splits streaming assistant text around a ```json fence so callers can hide
 * the raw ticket payload while it's still being generated. Once a ```json
 * fence has started, everything from that point on is withheld from
 * `visible` (whether or not the fence has closed yet) until the caller
 * replaces it with the parsed NotionTicketCard.
 */
export function splitStreamingText(text: string): { visible: string; generatingTicket: boolean } {
  const openMatch = text.match(/```json\s*/);
  if (!openMatch || openMatch.index === undefined) {
    return { visible: text, generatingTicket: false };
  }
  return { visible: text.slice(0, openMatch.index).trimEnd(), generatingTicket: true };
}
