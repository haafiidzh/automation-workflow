import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { StorageDriver, StoredFile } from "./storage";

/**
 * Not wired up by default (STORAGE_DRIVER=local is). Set STORAGE_DRIVER=s3
 * plus the S3_* env vars below to switch — works against AWS S3 or any
 * S3-compatible endpoint (Cloudflare R2, MinIO) via S3_ENDPOINT.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET env var is required when STORAGE_DRIVER=s3");
    this.bucket = bucket;

    this.client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  private key(sessionId: string, fileId: string): string {
    return `${sessionId}/${fileId}`;
  }

  async save(sessionId: string, buffer: Buffer): Promise<StoredFile> {
    const fileId = randomUUID();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(sessionId, fileId),
        Body: buffer,
      })
    );
    return { fileId, sessionId, size: buffer.length, storedAt: new Date().toISOString() };
  }

  async read(sessionId: string, fileId: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(sessionId, fileId) })
    );
    const bytes = await res.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async delete(sessionId: string, fileId: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(sessionId, fileId) })
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    const keys = await this.listKeys(sessionId);
    await Promise.all(
      keys.map((Key) => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key })))
    );
  }

  async renameSession(fromSessionId: string, toSessionId: string): Promise<void> {
    const keys = await this.listKeys(fromSessionId);
    for (const key of keys) {
      const fileId = key.slice(`${fromSessionId}/`.length);
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${key}`,
          Key: this.key(toSessionId, fileId),
        })
      );
    }
    await Promise.all(
      keys.map((Key) => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key })))
    );
  }

  private async listKeys(sessionId: string): Promise<string[]> {
    const listed = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${sessionId}/` })
    );
    return (listed.Contents ?? []).map((o) => o.Key!).filter(Boolean);
  }
}
