import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), ".storage", "uploads");

function ensureLocalStorageDir(): void {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

export function isS3Configured(): boolean {
  return Boolean(
    ENV.s3Bucket &&
    ENV.s3AccessKeyId &&
    ENV.s3SecretAccessKey
  );
}

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: ENV.s3Region || "us-east-1",
      endpoint: ENV.s3Endpoint || undefined,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
      // Force path style when using MinIO or custom local S3 endpoints
      forcePathStyle: Boolean(ENV.s3Endpoint),
    });
  }
  return _s3Client;
}

function normalizeKey(relKey: string): string {
  // Prevent directory traversal attacks
  const cleaned = relKey.replace(/^\/+/, "").replace(/\.\./g, "");
  return path.normalize(cleaned).replace(/\\/g, "/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * Stores a file in S3-compatible storage if configured, or falls back to local disk storage.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer =
    typeof data === "string"
      ? Buffer.from(data, "utf-8")
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data);

  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { key, url: `/api/storage/${key}` };
  }

  // Local storage fallback
  ensureLocalStorageDir();
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.writeFile(filePath, buffer);
  // Store content type metadata in sidecar file
  await fs.promises.writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }));

  return { key, url: `/api/storage/${key}` };
}

/**
 * Retrieves the URL for a stored key.
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/storage/${key}` };
}

/**
 * Generates a presigned GET URL for secure download from S3, or returns the local route.
 */
export async function storageGetSignedUrl(
  relKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const key = normalizeKey(relKey);

  if (isS3Configured()) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  // Local route
  return `/api/storage/${key}`;
}

/**
 * Deletes a stored file from S3 or local disk.
 */
export async function storageDelete(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);

  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
      })
    );
    return true;
  }

  ensureLocalStorageDir();
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath);
    }
    return true;
  }
  return false;
}

/**
 * Retrieves a file directly from local storage (used by the storage proxy route).
 */
export async function getLocalStorageFile(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const normalized = normalizeKey(key);
  const safePath = path.resolve(LOCAL_STORAGE_DIR, normalized);

  // Security check: ensure path is strictly inside LOCAL_STORAGE_DIR
  if (!safePath.startsWith(LOCAL_STORAGE_DIR)) {
    return null;
  }

  if (!fs.existsSync(safePath)) {
    return null;
  }

  const buffer = await fs.promises.readFile(safePath);
  let contentType = "application/octet-stream";
  const metaPath = `${safePath}.meta.json`;
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // ignore
    }
  }

  return { buffer, contentType };
}
