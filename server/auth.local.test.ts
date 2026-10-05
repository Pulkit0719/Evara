import { describe, expect, it, beforeEach } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import * as db from "./db";
import {
  hashPassword,
  verifyPassword,
  checkAuthRateLimit,
  recordAuthAttempt,
  resetAuthRateLimit,
  sanitizeUser,
} from "./services/auth";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createMockContext(user: any = null): {
  ctx: TrpcContext;
  cookiesSet: CookieCall[];
  cookiesCleared: CookieCall[];
} {
  const cookiesSet: CookieCall[] = [];
  const cookiesCleared: CookieCall[] = [];

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {
        "user-agent": "Vitest/1.0",
      },
      ip: "127.0.0.1",
    } as any,
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookiesSet.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookiesCleared.push({ name, options });
      },
    } as any,
  };

  return { ctx, cookiesSet, cookiesCleared };
}

describe("Password Hashing & Verification", () => {
  it("generates distinct salted scrypt hashes for identical passwords", async () => {
    const password = "SuperSecretPassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(hash1).toContain(":");
    expect(hash2).toContain(":");

    const [salt1] = hash1.split(":");
    const [salt2] = hash2.split(":");
    expect(salt1).not.toBe(salt2);
  });

  it("verifies correct password against hash", async () => {
    const password = "CorrectHorseBatteryStaple!";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const password = "CorrectPassword123!";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword("WrongPassword!", hash);
    expect(isMatch).toBe(false);
  });

  it("handles malformed or invalid hash formats safely", async () => {
    expect(await verifyPassword("password", "invalid_hash_string")).toBe(false);
    expect(await verifyPassword("password", "")).toBe(false);
    expect(await verifyPassword("password", "salt_only:")).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow("at least 8 characters");
  });
});

describe("Rate Limiting", () => {
  const testIp = "192.168.1.100";

  beforeEach(() => {
    resetAuthRateLimit(testIp);
  });

  it("allows requests under the attempt limit", () => {
    expect(() => checkAuthRateLimit(testIp)).not.toThrow();
    recordAuthAttempt(testIp);
    expect(() => checkAuthRateLimit(testIp)).not.toThrow();
  });

  it("blocks requests once the attempt limit is reached", () => {
    for (let i = 0; i < 10; i++) {
      recordAuthAttempt(testIp);
    }
    expect(() => checkAuthRateLimit(testIp)).toThrow(/Too many authentication attempts/);
  });

  it("resets rate limit upon resetAuthRateLimit call", () => {
    for (let i = 0; i < 10; i++) {
      recordAuthAttempt(testIp);
    }
    resetAuthRateLimit(testIp);
    expect(() => checkAuthRateLimit(testIp)).not.toThrow();
  });
});

describe("sanitizeUser helper", () => {
  it("removes passwordHash from user object", () => {
    const rawUser = {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      passwordHash: "salt:hash12345",
      loginMethod: "local",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const sanitized = sanitizeUser(rawUser as any);
    expect("passwordHash" in sanitized).toBe(false);
    expect(sanitized.email).toBe("test@example.com");
    expect(sanitized.id).toBe(1);
  });
});

describe("Auth Router Procedures with In-Memory Mock DB", () => {
  const usersStore = new Map<number, any>();
  const sessionsStore = new Map<string, any>();
  let nextUserId = 1;

  beforeEach(() => {
    usersStore.clear();
    sessionsStore.clear();
    nextUserId = 1;

    // Set up mock DB methods
    db.setTestDb({
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            limit: () => [],
            orderBy: () => [],
          }),
        }),
      }),
    });
  });

  it("auth.me returns null when unauthenticated", async () => {
    const { ctx } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns sanitized user when authenticated", async () => {
    const mockUser = {
      id: 42,
      openId: "usr_42",
      name: "Alex Learner",
      email: "alex@example.com",
      passwordHash: "salt:hash",
      role: "user",
      loginMethod: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const { ctx } = createMockContext(mockUser);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).not.toBeNull();
    expect(result?.id).toBe(42);
    expect(result?.email).toBe("alex@example.com");
    expect((result as any).passwordHash).toBeUndefined();
  });
});
