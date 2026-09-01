export type NotionTicket = {
  database_id: string;
  properties: Record<string, unknown>;
  content_markdown: string;
  people_names?: Record<string, string>;
};

function coerceNotionTicket(ticket: unknown): NotionTicket | null {
  if (
    typeof ticket !== "object" ||
    ticket === null ||
    typeof (ticket as NotionTicket).database_id !== "string" ||
    typeof (ticket as NotionTicket).properties !== "object" ||
    typeof (ticket as NotionTicket).content_markdown !== "string"
  ) {
    return null;
  }

  const t = ticket as NotionTicket;
  const rawNames = t.people_names;
  if (
    !rawNames ||
    typeof rawNames !== "object" ||
    !Object.entries(rawNames).every(([k, v]) => typeof k === "string" && typeof v === "string")
  ) {
    delete t.people_names;
  }

  return t;
}

/**
 * Extracts the last ```json ... ``` fenced block from agent output and
 * parses it as a { notion_tickets: NotionTicket[] } payload. Returns null if
 * no block is present, the array is empty, or no entry matches the expected
 * shape — the agent only emits this block when the brief targets Notion.
 */
export function parseNotionTickets(text: string): NotionTicket[] | null {
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
    !("notion_tickets" in parsed) ||
    !Array.isArray((parsed as { notion_tickets: unknown }).notion_tickets)
  ) {
    return null;
  }

  const tickets = ((parsed as { notion_tickets: unknown[] }).notion_tickets)
    .map(coerceNotionTicket)
    .filter((t): t is NotionTicket => t !== null);

  return tickets.length > 0 ? tickets : null;
}

export function stripNotionTicketBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```\s*$/, "").trimEnd();
}

export type NeedsInputField = {
  ticket?: string;
  property: string;
  type: "people" | "select" | "date" | "text";
  prompt: string;
  options?: { id: string; label: string }[];
};

export type NotionNeedsInput = { fields: NeedsInputField[] };

/**
 * Extracts the last ```json ... ``` fenced block and parses it as a
 * { notion_ticket_needs_input: NotionNeedsInput } payload — the agent emits
 * this instead of notion_ticket when a required property can't be safely
 * filled in. Malformed field entries are dropped rather than nulling the
 * whole result; returns null only if nothing usable remains.
 */
export function parseNeedsInput(text: string): NotionNeedsInput | null {
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
    !("notion_ticket_needs_input" in parsed)
  ) {
    return null;
  }

  const payload = (parsed as { notion_ticket_needs_input: unknown }).notion_ticket_needs_input;
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { fields: unknown }).fields)) {
    return null;
  }

  const validTypes = new Set(["people", "select", "date", "text"]);
  const fields = ((payload as { fields: unknown[] }).fields)
    .filter((f): f is NeedsInputField => {
      if (typeof f !== "object" || f === null) return false;
      const o = f as Record<string, unknown>;
      if (typeof o.property !== "string" || typeof o.prompt !== "string") return false;
      if (typeof o.type !== "string" || !validTypes.has(o.type)) return false;
      if (o.ticket !== undefined && typeof o.ticket !== "string") return false;
      if (o.options !== undefined) {
        if (!Array.isArray(o.options)) return false;
        return o.options.every(
          (opt) =>
            opt && typeof opt === "object" &&
            typeof (opt as Record<string, unknown>).id === "string" &&
            typeof (opt as Record<string, unknown>).label === "string"
        );
      }
      return true;
    });

  if (fields.length === 0) return null;
  return { fields };
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

/**
 * Pulls a leading `# Heading` line off markdown body content, if present —
 * agents often repeat the full descriptive title as the first H1 of
 * content_markdown (the `Name` title property itself is often a short code
 * like "B-BUG-20" per project naming rules). Returns null when there's no
 * leading H1, so callers can fall back to the raw title property.
 */
export function extractLeadingHeading(markdown: string): { heading: string; rest: string } | null {
  const match = markdown.match(/^\s*#\s+(.+?)\s*\n+([\s\S]*)$/);
  if (!match) return null;
  return { heading: match[1], rest: match[2] };
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
export function formatNotionProperties(
  properties: Record<string, unknown>,
  peopleNames?: Record<string, string>
): NotionPropertyDisplay[] {
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
              if (typeof p.id === "string") return peopleNames?.[p.id] ?? p.id;
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
