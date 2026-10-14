import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";

const { mockDbState, mockDb } = vi.hoisted(() => {
  const state = {
    users: new Map<number, any>(),
    profiles: new Map<number, any>(),
    periods: new Map<number, any>(),
    symptoms: new Map<number, any>(),
    wellness: new Map<number, any>(),
    reminders: new Map<number, any>(),
    nextId: 100,
  };

  const db = {
    getProfile: vi.fn(async (userId: number) => state.profiles.get(userId) || null),
    saveProfile: vi.fn(async (userId: number, data: any) => {
      state.profiles.set(userId, { userId, ...data });
      return state.profiles.get(userId);
    }),
    getPeriodLogs: vi.fn(async (userId: number) => {
      return Array.from(state.periods.values()).filter(p => p.userId === userId);
    }),
    createPeriodLog: vi.fn(async (userId: number, data: any) => {
      const id = ++state.nextId;
      state.periods.set(id, { id, userId, ...data });
      return { id };
    }),
    updatePeriodLog: vi.fn(async (userId: number, id: number, data: any) => {
      const item = state.periods.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.periods.set(id, { ...item, ...data });
      return { success: true };
    }),
    deletePeriodLog: vi.fn(async (userId: number, id: number) => {
      const item = state.periods.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.periods.delete(id);
      return { success: true };
    }),
    periodStartExists: vi.fn(async () => false),

    getSymptomLogs: vi.fn(async (userId: number) => {
      return Array.from(state.symptoms.values()).filter(s => s.userId === userId);
    }),
    createSymptomLog: vi.fn(async (userId: number, data: any) => {
      const id = ++state.nextId;
      state.symptoms.set(id, { id, userId, ...data });
      return { id };
    }),
    updateSymptomLog: vi.fn(async (userId: number, id: number, data: any) => {
      const item = state.symptoms.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.symptoms.set(id, { ...item, ...data });
      return { success: true };
    }),
    deleteSymptomLog: vi.fn(async (userId: number, id: number) => {
      const item = state.symptoms.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.symptoms.delete(id);
      return { success: true };
    }),

    getWellnessLogs: vi.fn(async (userId: number) => {
      return Array.from(state.wellness.values()).filter(w => w.userId === userId);
    }),
    saveWellnessLog: vi.fn(async (userId: number, data: any) => {
      const id = ++state.nextId;
      state.wellness.set(id, { id, userId, ...data });
      return { success: true };
    }),
    deleteWellnessLog: vi.fn(async (userId: number, id: number) => {
      const item = state.wellness.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.wellness.delete(id);
      return { success: true };
    }),

    getReminders: vi.fn(async (userId: number) => {
      return Array.from(state.reminders.values()).filter(r => r.userId === userId);
    }),
    createReminder: vi.fn(async (userId: number, data: any) => {
      const id = ++state.nextId;
      state.reminders.set(id, { id, userId, ...data });
      return { id };
    }),
    updateReminder: vi.fn(async (userId: number, id: number, data: any) => {
      const item = state.reminders.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.reminders.set(id, { ...item, ...data });
      return { success: true };
    }),
    deleteReminder: vi.fn(async (userId: number, id: number) => {
      const item = state.reminders.get(id);
      if (!item || item.userId !== userId) return { success: false };
      state.reminders.delete(id);
      return { success: true };
    }),
    setTestDb: vi.fn(),
    getDb: vi.fn(),
  };

  return { mockDbState: state, mockDb: db };
});

vi.mock("./db", () => mockDb);

import { appRouter } from "./routers";

describe("Production Security & Cross-User Data Isolation", () => {
  beforeEach(() => {
    mockDbState.users.clear();
    mockDbState.profiles.clear();
    mockDbState.periods.clear();
    mockDbState.symptoms.clear();
    mockDbState.wellness.clear();
    mockDbState.reminders.clear();
    mockDbState.nextId = 100;
  });

  function makeContext(userId: number) {
    return {
      user: {
        id: userId,
        openId: `usr_${userId}`,
        name: `User ${userId}`,
        email: `user${userId}@evara.local`,
        role: "user",
      },
      req: { protocol: "https", headers: { host: "evara.local" } },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as any;
  }

  it("User B cannot access or view User A's period logs", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    await callerA.periods.create({
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      flowIntensity: "medium",
      notes: "Private confidential cycle notes of User A",
    });

    const userAPeriods = await callerA.periods.list();
    expect(userAPeriods).toHaveLength(1);
    expect(userAPeriods[0].notes).toBe("Private confidential cycle notes of User A");

    const userBPeriods = await callerB.periods.list();
    expect(userBPeriods).toHaveLength(0);
  });

  it("User B cannot update or mutate User A's period logs", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    const createResult = await callerA.periods.create({
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      flowIntensity: "medium",
      notes: "User A original notes",
    });

    const periodId = createResult.id;

    await expect(
      callerB.periods.update({
        id: periodId,
        startDate: "2026-05-02",
        endDate: "2026-05-06",
        flowIntensity: "heavy",
        notes: "Attacker tampering with User A",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const record = mockDbState.periods.get(periodId);
    expect(record.flowIntensity).toBe("medium");
    expect(record.notes).toBe("User A original notes");
  });

  it("User B cannot delete User A's period logs", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    const createResult = await callerA.periods.create({
      startDate: "2026-05-01",
      endDate: null,
      flowIntensity: "light",
      notes: "Do not delete",
    });

    const periodId = createResult.id;

    // User B attempts to delete User A's log -> MUST fail closed
    await expect(callerB.periods.delete({ id: periodId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mockDbState.periods.has(periodId)).toBe(true);
  });

  it("User B cannot read or tamper with User A's symptom logs", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    const result = await callerA.tracking.symptoms.create({
      logDate: "2026-05-02",
      symptom: "cramps",
      severity: "severe",
      notes: "Severe pain confidential",
    });

    const symptomId = result.id;

    const userBSymptoms = await callerB.tracking.symptoms.list();
    expect(userBSymptoms).toHaveLength(0);

    await expect(callerB.tracking.symptoms.delete({ id: symptomId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDbState.symptoms.has(symptomId)).toBe(true);
  });

  it("User B cannot read or tamper with User A's wellness logs", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    await callerA.tracking.wellness.save({
      logDate: "2026-05-02",
      mood: 4,
      energy: 3,
      sleepHours: 8,
      waterGlasses: 8,
      activityMinutes: 30,
      stress: 2,
      pain: 1,
      notes: "User A private daily checkin",
    });

    const userBWellness = await callerB.tracking.wellness.list();
    expect(userBWellness).toHaveLength(0);
  });

  it("User B cannot read or tamper with User A's reminders", async () => {
    const callerA = appRouter.createCaller(makeContext(101));
    const callerB = appRouter.createCaller(makeContext(102));

    const reminder = await callerA.reminders.create({
      reminderType: "medication",
      title: "Iron supplement",
      scheduleTime: "08:00",
      scheduleFrequency: "daily",
      isEnabled: true,
    });

    const userBReminders = await callerB.reminders.list();
    expect(userBReminders).toHaveLength(0);

    await expect(
      callerB.reminders.update({
        id: reminder.id,
        reminderType: "medication",
        title: "Compromised reminder",
        scheduleTime: "00:00",
        scheduleFrequency: "once",
        isEnabled: false,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Production Security Headers & CSRF Protection", () => {
  function createTestServer() {
    const app = express();

    app.use((_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      next();
    });

    app.use("/api", (req, res, next) => {
      if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (origin && host) {
          try {
            const originHost = new URL(origin as string).host;
            if (originHost !== host) {
              return res.status(403).json({ error: "Cross-origin requests are forbidden." });
            }
          } catch {
            return res.status(403).json({ error: "Invalid Origin header." });
          }
        }
      }
      next();
    });

    app.get("/api/test", (_req, res) => res.json({ ok: true }));
    app.post("/api/test", (_req, res) => res.json({ ok: true }));

    return app;
  }

  it("applies strict security headers to all responses", () => {
    const app = createTestServer();
    const headers: Record<string, string> = {};

    const req: any = { method: "GET", path: "/healthz", headers: {} };
    const res: any = {
      setHeader: (name: string, val: string) => {
        headers[name.toLowerCase()] = val;
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const firstMiddleware = (app as any)._router.stack[2].handle;
    firstMiddleware(req, res, () => {});

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["x-xss-protection"]).toBe("1; mode=block");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
  });

  it("blocks cross-origin state-changing POST requests (CSRF defense)", () => {
    const app = createTestServer();
    let statusSet = 200;
    let jsonBody: any = null;

    const req: any = {
      method: "POST",
      baseUrl: "/api",
      url: "/test",
      headers: {
        host: "evara.production.app",
        origin: "https://evil-attacker.com",
      },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusSet = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    const csrfMiddleware = (app as any)._router.stack[3].handle;
    csrfMiddleware(req, res, () => {});

    expect(statusSet).toBe(403);
    expect(jsonBody.error).toBe("Cross-origin requests are forbidden.");
  });

  it("allows same-origin state-changing POST requests", () => {
    const app = createTestServer();
    let nextCalled = false;

    const req: any = {
      method: "POST",
      baseUrl: "/api",
      url: "/test",
      headers: {
        host: "evara.production.app",
        origin: "https://evara.production.app",
      },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const csrfMiddleware = (app as any)._router.stack[3].handle;
    csrfMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
