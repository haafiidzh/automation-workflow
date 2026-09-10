import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { S3StorageDriver } from "./storage-s3";

export type StoredFile = {
  fileId: string;
  sessionId: string;
  size: number;
  storedAt: string;
};

export interface StorageDriver {
  save(sessionId: string, buffer: Buffer): Promise<StoredFile>;
  read(sessionId: string, fileId: string): Promise<Buffer>;
  delete(sessionId: string, fileId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  /**
   * Uploads made before a chat session has a real (SDK-assigned) session id
   * are stored under a client-generated draft id. Once the SDK returns the
   * real id, the chat route renames the draft folder to it so retention
   * (delete-on-session-delete) has a single consistent key going forward.
   */
  renameSession(fromSessionId: string, toSessionId: string): Promise<void>;
}

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

function assertSessionId(sessionId: string): void {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
}

class LocalStorageDriver implements StorageDriver {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private sessionDir(sessionId: string): string {
    assertSessionId(sessionId);
    return path.join(this.rootDir, sessionId);
  }

  private filePath(sessionId: string, fileId: string): string {
    if (!SESSION_ID_RE.test(fileId)) {
      throw new Error(`Invalid fileId: ${fileId}`);
    }
    return path.join(this.sessionDir(sessionId), fileId);
  }

  async save(sessionId: string, buffer: Buffer): Promise<StoredFile> {
    const dir = this.sessionDir(sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const fileId = randomUUID();
    fs.writeFileSync(path.join(dir, fileId), buffer);
    return { fileId, sessionId, size: buffer.length, storedAt: new Date().toISOString() };
  }

  async read(sessionId: string, fileId: string): Promise<Buffer> {
    return fs.readFileSync(this.filePath(sessionId, fileId));
  }

  async delete(sessionId: string, fileId: string): Promise<void> {
    const p = this.filePath(sessionId, fileId);
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const dir = this.sessionDir(sessionId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }

  async renameSession(fromSessionId: string, toSessionId: string): Promise<void> {
    const from = this.sessionDir(fromSessionId);
    if (!fs.existsSync(from)) return;
    const to = this.sessionDir(toSessionId);
    if (fs.existsSync(to)) {
      for (const entry of fs.readdirSync(from)) {
        fs.renameSync(path.join(from, entry), path.join(to, entry));
      }
      fs.rmdirSync(from);
    } else {
      fs.renameSync(from, to);
    }
  }
}

let cachedDriver: StorageDriver | undefined;

export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;

  const driverName = process.env.STORAGE_DRIVER ?? "local";
  if (driverName === "local") {
    const rootDir = process.env.STORAGE_LOCAL_DIR
      ? path.resolve(process.env.STORAGE_LOCAL_DIR)
      : path.join(process.cwd(), "workflow", "uploads");
    cachedDriver = new LocalStorageDriver(rootDir);
    return cachedDriver;
  }

  if (driverName === "s3") {
    cachedDriver = new S3StorageDriver();
    return cachedDriver;
  }

  throw new Error(`Unknown STORAGE_DRIVER: ${driverName}`);
}
