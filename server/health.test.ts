import { describe, expect, it, vi } from "vitest";
import express from "express";
import { sql } from "drizzle-orm";
import * as dbModule from "./db";

function createHealthApp() {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/readyz", async (_req, res) => {
    try {
      const db = await dbModule.getDb();
      if (!db) {
        res.status(503).json({
          status: "degraded",
          database: "not_configured",
          timestamp: new Date().toISOString(),
        });
        return;
      }

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

  return app;
}

function mockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe("Liveness & Readiness Endpoints", () => {
  it("/healthz reports liveness ok without database query", async () => {
    const app = createHealthApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/healthz")?.route;

    const req: any = {};
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });

  it("/readyz executes SELECT 1 and returns ready when database is reachable", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };
    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    const app = createHealthApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/readyz")?.route;

    const req: any = {};
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.database).toBe("connected");
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it("/readyz returns 503 degraded when database is not configured", async () => {
    vi.spyOn(dbModule, "getDb").mockResolvedValue(null);

    const app = createHealthApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/readyz")?.route;

    const req: any = {};
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.database).toBe("not_configured");
  });

  it("/readyz returns 503 error when database SELECT 1 query fails", async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error("Connection refused (ECONNREFUSED)")),
    };
    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    const app = createHealthApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/readyz")?.route;

    const req: any = {};
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("error");
    expect(res.body.database).toBe("disconnected");
    expect(res.body.message).toContain("ECONNREFUSED");
  });
});
