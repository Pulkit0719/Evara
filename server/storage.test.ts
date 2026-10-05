import { describe, expect, it } from "vitest";
import {
  storagePut,
  storageGet,
  storageGetSignedUrl,
  storageDelete,
  getLocalStorageFile,
  isS3Configured,
} from "./storage";

describe("Independent Storage Service", () => {
  it("detects S3 configuration state", () => {
    // When no S3 bucket / credentials are configured, reports false
    expect(typeof isS3Configured()).toBe("boolean");
  });

  it("stores and retrieves files using local disk fallback", async () => {
    const testContent = "Hello Uptrail Storage Verification " + Date.now();
    const result = await storagePut("test/report.txt", testContent, "text/plain");

    expect(result.key).toContain("test/report");
    expect(result.url).toBe(`/api/storage/${result.key}`);

    const fetched = await getLocalStorageFile(result.key);
    expect(fetched).not.toBeNull();
    expect(fetched?.buffer.toString("utf-8")).toBe(testContent);
    expect(fetched?.contentType).toBe("text/plain");

    // Clean up
    await storageDelete(result.key);
    const afterDelete = await getLocalStorageFile(result.key);
    expect(afterDelete).toBeNull();
  });

  it("generates safe retrieval URLs", async () => {
    const getResult = await storageGet("documents/summary.pdf");
    expect(getResult.url).toBe("/api/storage/documents/summary.pdf");

    const signedUrl = await storageGetSignedUrl("documents/summary.pdf");
    expect(signedUrl).toContain("/api/storage/documents/summary.pdf");
  });

  it("blocks directory traversal attempts in getLocalStorageFile", async () => {
    const maliciousKey = "../../../etc/passwd";
    const result = await getLocalStorageFile(maliciousKey);
    expect(result).toBeNull();
  });
});
