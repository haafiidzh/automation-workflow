/**
 * The filesystem a project scan runs on top of.
 *
 * Two implementations exist: Node `fs` (server, in `lib/claude-dir.ts`) and the
 * local agent reached from the browser (`lib/local-agent-client.ts`). This
 * module must stay importable from the browser, so it may not pull in `fs` or
 * anything that does — that is why the frontmatter parsing lives in
 * `lib/project-scan.ts` instead.
 */

export type DirEntry = { name: string; type: "file" | "dir" };

export type FsSource = {
  list(path: string): Promise<DirEntry[]>;
  read(path: string): Promise<string>;
};

/**
 * Stable error codes. Callers branch on `code`, never on the message — the
 * message is written for humans and is free to change.
 */
export type FsErrorCode =
  | "not-found"
  | "forbidden"
  | "unpaired"
  | "timeout"
  | "too-large"
  | "unknown";

export class FsSourceError extends Error {
  readonly code: FsErrorCode;
  constructor(code: FsErrorCode, message: string) {
    super(message);
    this.name = "FsSourceError";
    this.code = code;
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof FsSourceError && err.code === "not-found";
}

/**
 * POSIX-only join. `path.join` is not usable here: these paths describe the
 * user's machine, which may not be the machine running this code.
 */
export function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((p) => p !== "")
    .join("/")
    .replace(/\/{2,}/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

/**
 * Everything a project scan needs to read, captured in one plain object.
 *
 * Collecting and interpreting are separate steps so the collecting half can run
 * in the browser (against the local agent) while the interpreting half stays on
 * the server, where the frontmatter parser lives.
 *
 * `null` means "probed and not there", which is different from an absent key
 * (never probed) and different from an empty listing.
 */
export type ScanInput = {
  projectPath: string;
  dirs: Record<string, DirEntry[] | null>;
  files: Record<string, string | null>;
};

const CLAUDE = ".claude";

export function claudePaths(projectPath: string) {
  const claudeDir = joinPath(projectPath, CLAUDE);
  return {
    claudeDir,
    agentsDir: joinPath(claudeDir, "agents"),
    docsDir: joinPath(claudeDir, "docs"),
    rulesDir: joinPath(claudeDir, "rules"),
  };
}

async function tryList(src: FsSource, path: string): Promise<DirEntry[] | null> {
  try {
    return await src.list(path);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Runs `jobs` with at most `limit` in flight, preserving input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** How many reads may be in flight against one local agent at a time. */
export const SCAN_CONCURRENCY = 4;

/**
 * Reads every directory and file a scan (and the rules bundle) depends on.
 * Pure traversal — no parsing, no validation, no `fs`.
 */
export async function collectScanInput(
  src: FsSource,
  projectPath: string,
  /**
   * Rule files are only needed when a chat session is about to start. Listing
   * a project for the picker skips them so scanning ten projects does not read
   * ten rule bundles.
   */
  opts: { includeRules?: boolean } = {}
): Promise<ScanInput> {
  const includeRules = opts.includeRules ?? true;
  const { agentsDir, docsDir, rulesDir } = claudePaths(projectPath);

  const [projectEntries, agentEntries, docEntries, ruleEntries] = await Promise.all([
    tryList(src, projectPath),
    tryList(src, agentsDir),
    tryList(src, docsDir),
    tryList(src, rulesDir),
  ]);

  const dirs: ScanInput["dirs"] = {
    [projectPath]: projectEntries,
    [agentsDir]: agentEntries,
    [docsDir]: docEntries,
    [rulesDir]: ruleEntries,
  };

  const toRead: string[] = [];
  for (const e of agentEntries ?? []) {
    if (e.type === "file" && e.name.endsWith(".md")) toRead.push(joinPath(agentsDir, e.name));
  }
  if (includeRules) {
    for (const e of ruleEntries ?? []) {
      if (e.type === "file") toRead.push(joinPath(rulesDir, e.name));
    }
  }

  const contents = await mapLimit(toRead, SCAN_CONCURRENCY, async (p) => {
    try {
      return await src.read(p);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  });

  const files: ScanInput["files"] = {};
  toRead.forEach((p, i) => {
    files[p] = contents[i];
  });

  return { projectPath, dirs, files };
}

/**
 * An `FsSource` backed by an already-collected `ScanInput`. Used on the server
 * to replay a scan the browser gathered, without touching any disk.
 */
export function memoryFsSource(input: ScanInput): FsSource {
  return {
    async list(path: string) {
      const entries = input.dirs[path];
      if (!entries) throw new FsSourceError("not-found", `${path} is not in the scan payload`);
      return entries;
    },
    async read(path: string) {
      const content = input.files[path];
      if (content === undefined || content === null) {
        throw new FsSourceError("not-found", `${path} is not in the scan payload`);
      }
      return content;
    },
  };
}
