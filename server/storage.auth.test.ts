import { describe, expect, it, vi } from "vitest";
import express from "express";
import { registerStorageProxy } from "./_core/storageProxy";
import * as authService from "./services/auth";
import * as storageService from "./storage";

function createMockApp() {
  const app = express();
  registerStorageProxy(app);
  return app;
}

function mockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, val: string) {
      this.headers[name] = val;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    redirect(status: number, url: string) {
      this.statusCode = status;
      this.body = url;
      return this;
    },
  };
  return res;
}

describe("Storage Authorization Proxy (/api/storage/*)", () => {
  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    vi.spyOn(authService, "authenticateRequest").mockResolvedValue(null);

    const app = createMockApp();
    const router = (app as any)._router;
    const route = router.stack.find((s: any) => s.route?.path === "/api/storage/*")?.route;
    expect(route).toBeDefined();

    const req: any = { params: ["users/1/data.csv"], headers: {} };
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("Unauthorized");
  });

  it("blocks user 1 from accessing user 2's stored files (403 Forbidden)", async () => {
    vi.spyOn(authService, "authenticateRequest").mockResolvedValue({
      id: 1,
      role: "user",
    } as any);

    const app = createMockApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/api/storage/*")?.route;

    const req: any = { params: ["users/2/private-report.pdf"], headers: {} };
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain("Forbidden");
  });

  it("allows user 1 to access their own stored file", async () => {
    vi.spyOn(authService, "authenticateRequest").mockResolvedValue({
      id: 1,
      role: "user",
    } as any);
    vi.spyOn(storageService, "isS3Configured").mockReturnValue(false);
    vi.spyOn(storageService, "getLocalStorageFile").mockResolvedValue({
      buffer: Buffer.from("private health report content"),
      contentType: "text/plain",
    });

    const app = createMockApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/api/storage/*")?.route;

    const req: any = { params: ["users/1/private-report.pdf"], headers: {} };
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/plain");
    expect(res.body.toString()).toBe("private health report content");
  });

  it("allows admin to access any user's file for maintenance", async () => {
    vi.spyOn(authService, "authenticateRequest").mockResolvedValue({
      id: 99,
      role: "admin",
    } as any);
    vi.spyOn(storageService, "isS3Configured").mockReturnValue(false);
    vi.spyOn(storageService, "getLocalStorageFile").mockResolvedValue({
      buffer: Buffer.from("admin inspected content"),
      contentType: "text/plain",
    });

    const app = createMockApp();
    const route = (app as any)._router.stack.find((s: any) => s.route?.path === "/api/storage/*")?.route;

    const req: any = { params: ["users/2/data.json"], headers: {} };
    const res = mockResponse();

    await route.stack[0].handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe("admin inspected content");
  });
});
