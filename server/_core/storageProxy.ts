import type { Express, Request, Response } from "express";
import { getLocalStorageFile, isS3Configured, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  // Primary application storage endpoint
  app.get("/api/storage/*", async (req: Request, res: Response) => {
    const rawKey = req.params[0] || "";
    if (!rawKey) {
      res.status(400).send("Storage key is required.");
      return;
    }

    try {
      if (isS3Configured()) {
        const presignedUrl = await storageGetSignedUrl(rawKey, 3600);
        res.redirect(307, presignedUrl);
        return;
      }

      // Local storage fallback
      const fileData = await getLocalStorageFile(rawKey);
      if (!fileData) {
        res.status(404).send("File not found.");
        return;
      }

      res.setHeader("Content-Type", fileData.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(fileData.buffer);
    } catch (error) {
      console.error("[Storage Proxy] Error retrieving file:", error);
      res.status(500).send("Error retrieving file.");
    }
  });

  // Legacy route redirect for seamless backward compatibility
  app.get("/manus-storage/*", (req: Request, res: Response) => {
    const key = req.params[0] || "";
    res.redirect(301, `/api/storage/${key}`);
  });
}
