/**
 * Browser-side project discovery.
 *
 * When a local agent is paired, the project list and every validation come from
 * the user's machine: the tab reads the directories, the server only interprets
 * what the tab sends. This module is the glue between the two halves.
 */

import { collectScanInput, type ScanInput } from "./fs-source";
import { listProjects, localAgentFsSource } from "./local-agent-client";
import type { LocalProject, Project, ProjectScanResponse } from "./types";

export type Discovery = {
  projects: Project[];
  /** Full scan per project id — agents and docs, not just validity. */
  scans: Record<string, ProjectScanResponse>;
  /** The raw roots, kept because chat needs the absolute path and the mode. */
  roots: Record<string, LocalProject>;
};

/** Must stay under the server's own limit in `app/api/projects/scan`. */
const MAX_BATCH_BYTES = 1.5 * 1024 * 1024;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

/** Splits inputs so no single request goes over the server's size limit. */
function batchBySize(inputs: ScanInput[]): ScanInput[][] {
  const batches: ScanInput[][] = [];
  let current: ScanInput[] = [];
  let size = 0;
  for (const input of inputs) {
    const bytes = JSON.stringify(input).length;
    if (current.length > 0 && size + bytes > MAX_BATCH_BYTES) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(input);
    size += bytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

type ScanResponse = { scans: { projectPath: string; scan: ProjectScanResponse }[] };

async function interpret(inputs: ScanInput[]): Promise<Record<string, ProjectScanResponse>> {
  const byPath: Record<string, ProjectScanResponse> = {};
  for (const batch of batchBySize(inputs)) {
    const res = await fetch("/api/projects/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: batch }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `scan gagal (HTTP ${res.status})`);
    }
    const data = (await res.json()) as ScanResponse;
    for (const item of data.scans) byPath[item.projectPath] = item.scan;
  }
  return byPath;
}

/** Concurrent reads against one local agent. */
export const DISCOVERY_CONCURRENCY = 4;

/**
 * Short-lived in-memory cache of scans, keyed by project path.
 *
 * Deliberately not `localStorage`: the folders it describes can change on disk
 * at any moment, and a stale project list that survives a reload is more
 * confusing than no cache at all. Thirty seconds covers a page navigation and
 * a reconnect, nothing more.
 */
const SCAN_TTL_MS = 30_000;
const scanCache = new Map<string, { at: number; scan: ProjectScanResponse }>();

function cachedScan(path: string): ProjectScanResponse | undefined {
  const hit = scanCache.get(path);
  if (!hit) return undefined;
  if (Date.now() - hit.at > SCAN_TTL_MS) {
    scanCache.delete(path);
    return undefined;
  }
  return hit.scan;
}

function rememberScan(path: string, scan: ProjectScanResponse) {
  scanCache.set(path, { at: Date.now(), scan });
}

/** Drops every cached scan, so the next discovery re-reads the machine. */
export function clearScanCache() {
  scanCache.clear();
}

/**
 * Lists the machine's projects and validates each one. A project the agent
 * refuses (or that has vanished) is reported as invalid rather than failing the
 * whole list — one broken folder must not empty the picker.
 */
export async function discoverLocalProjects(
  opts: { force?: boolean } = {}
): Promise<Discovery> {
  const roots = await listProjects();
  const src = localAgentFsSource();

  const collected = await mapLimit(roots, DISCOVERY_CONCURRENCY, async (root) => {
    const cached = opts.force ? undefined : cachedScan(root.path);
    if (cached) return { root, input: null, cached, error: null as string | null };
    try {
      return {
        root,
        input: await collectScanInput(src, root.path, { includeRules: false }),
        cached: undefined,
        error: null as string | null,
      };
    } catch (err) {
      return {
        root,
        input: null,
        cached: undefined,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const usable = collected.filter((c) => c.input !== null);
  const scansByPath = usable.length
    ? await interpret(usable.map((c) => c.input as ScanInput))
    : {};

  const projects: Project[] = [];
  const scans: Record<string, ProjectScanResponse> = {};
  const rootsById: Record<string, LocalProject> = {};

  for (const item of collected) {
    rootsById[item.root.id] = item.root;
    const scan = item.cached ?? (item.input ? scansByPath[item.root.path] : undefined);
    if (!scan) {
      projects.push({
        id: item.root.id,
        label: item.root.label,
        path: item.root.path,
        valid: false,
        missing: [item.error ?? "scan tidak terbaca dari local agent"],
      });
      continue;
    }
    scans[item.root.id] = scan;
    rememberScan(item.root.path, scan);
    projects.push({
      id: item.root.id,
      label: item.root.label,
      path: item.root.path,
      valid: scan.validation.valid,
      missing: scan.validation.missing,
    });
  }

  return { projects, scans, roots: rootsById };
}

/** Re-validates a single project, for the picker's refresh button. */
export async function rescanLocalProject(
  path: string,
  opts: { force?: boolean } = {}
): Promise<ProjectScanResponse> {
  if (!opts.force) {
    const cached = cachedScan(path);
    if (cached) return cached;
  }
  const input = await collectScanInput(localAgentFsSource(), path, { includeRules: false });
  const byPath = await interpret([input]);
  const scan = byPath[path];
  if (!scan) throw new Error("server tidak mengembalikan hasil scan untuk project ini");
  rememberScan(path, scan);
  return scan;
}
