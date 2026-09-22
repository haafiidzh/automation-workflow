import fs from "fs";
import path from "path";

const WORKFLOW_DIR = path.join(process.cwd(), "workflow");
const USERS_FILE = path.join(WORKFLOW_DIR, "users.json");

export type User = {
  id: string;
  username: string;
  label: string;
  /**
   * Reserved for the password milestone. Always `null` today; the field
   * exists now so adding passwords later does not reshape the file.
   */
  passwordHash: string | null;
};

/**
 * Reads workflow/users.json on every call — deliberately uncached. The file is
 * edited by hand, and a stale cache would make "I added a user but cannot log
 * in" impossible to debug.
 */
export function getUsers(): User[] {
  if (!fs.existsSync(USERS_FILE)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch (err) {
    throw new Error(
      `workflow/users.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error("workflow/users.json must contain a JSON array of users");
  }

  const users = parsed.map((row, i) => {
    const r = row as Partial<User>;
    if (!r.id || !r.username) {
      throw new Error(`workflow/users.json entry #${i} is missing "id" or "username"`);
    }
    return {
      id: r.id,
      username: r.username,
      label: r.label ?? r.username,
      passwordHash: r.passwordHash ?? null,
    };
  });

  // Duplicate usernames must fail loudly: silently picking the first match
  // would hand one person another person's chat history and Notion account.
  const seen = new Set<string>();
  for (const u of users) {
    const key = u.username.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`workflow/users.json has a duplicate username: "${u.username}"`);
    }
    seen.add(key);
  }

  const seenIds = new Set<string>();
  for (const u of users) {
    if (seenIds.has(u.id)) {
      throw new Error(`workflow/users.json has a duplicate id: "${u.id}"`);
    }
    seenIds.add(u.id);
  }

  return users;
}

/** Case-insensitive lookup; the stored casing is preserved as written. */
export function getUserByUsername(username: string): User | undefined {
  const key = username.trim().toLowerCase();
  if (!key) return undefined;
  return getUsers().find((u) => u.username.toLowerCase() === key);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}
