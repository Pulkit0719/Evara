import "dotenv/config";
import express, { type Request, type Response, type Express } from "express";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import { getDb } from "../db";

export function createExpressApp(): Express {
  const app = express();

  // Trust first proxy hop (essential for Vercel, Render, and reverse proxies)
  app.set("trust proxy", 1);

  // Restore original request URL if rewritten by Vercel serverless gateway
  app.use((req, _res, next) => {
    if (req.originalUrl && req.url !== req.originalUrl) {
      req.url = req.originalUrl;
    }
    next();
  });

  // Production security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // Same-origin CSRF protection for state-changing API endpoints
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const origin = req.headers.origin;
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
      if (origin && host) {
        try {
          const originHost = new URL(origin).host.split(":")[0];
          const incomingHost = host.split(",")[0].trim().split(":")[0];
          if (originHost !== incomingHost) {
            return res.status(403).json({ error: "Cross-origin requests are forbidden." });
          }
        } catch {
          return res.status(403).json({ error: "Invalid Origin header." });
        }
      }
    }
    next();
  });

  // Body parser with sensible size limit
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Liveness health check (verifies process/function is running)
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness health check (verifies actual database connectivity)
  app.get("/readyz", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({
          status: "degraded",
          database: "not_configured",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Execute lightweight probe against database
      await db.execute(sql`SELECT 1`);

      res.status(200).json({
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        message: error?.message || "Database connectivity check failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // File storage proxy with authentication and user ownership checks
  registerStorageProxy(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve static build in non-development mode (ignored if on edge/serverless CDN)
  if (process.env.NODE_ENV !== "development") {
    serveStatic(app);
  }

  return app;
}
