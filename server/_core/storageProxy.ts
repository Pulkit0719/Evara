import type { Express, Request, Response } from "express";
import { authenticateRequest } from "../services/auth";
import { getLocalStorageFile, isS3Configured, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  // Protected application storage endpoint
  app.get("/api/storage/*", async (req: Request, res: Response) => {
    const rawKey = req.params[0] || "";
    if (!rawKey) {
      res.status(400).send("Storage key is required.");
      return;
    }

    try {
      // Storage access requires an authenticated session
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).send("Unauthorized: Authentication required.");
        return;
      }

      // Enforce user ownership scoping if the key includes a user identifier
      const segments = rawKey.split("/").filter(Boolean);
      let targetUserId: number | null = null;
      if (segments[0] === "users" && segments[1] && !Number.isNaN(Number(segments[1]))) {
        targetUserId = Number(segments[1]);
      } else if (segments[0] && !Number.isNaN(Number(segments[0]))) {
        targetUserId = Number(segments[0]);
      }

      if (targetUserId !== null && targetUserId !== user.id && user.role !== "admin") {
        res.status(403).send("Forbidden: You do not have permission to access this resource.");
        return;
      }

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
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      res.send(fileData.buffer);
    } catch (error) {
      console.error("[Storage Proxy] Error retrieving file:", error);
      res.status(500).send("Error retrieving file.");
    }
  });
}
