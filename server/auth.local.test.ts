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
  hashSessionToken,
  createSession,
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

describe("Session Security & Token Hashing", () => {
  it("hashes session tokens using SHA-256 for database storage", () => {
    const rawToken = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const hash = hashSessionToken(rawToken);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(rawToken);
    // Deterministic hash
    expect(hashSessionToken(rawToken)).toBe(hash);
  });

  it("fails closed when session persistence fails (never sets cookie)", async () => {
    const { ctx, cookiesSet } = createMockContext(null);
    const mockUser = { id: 1, email: "user@example.com" } as any;

    // Simulate database failure during session record creation
    db.setTestDb({
      insert: () => ({
        values: () => {
          throw new Error("DB Connection Lost");
        },
      }),
    });

    await expect(createSession(mockUser, ctx.req, ctx.res)).rejects.toThrow(
      /Session persistence failed|failed closed/i
    );
    // Invariant: Cookie MUST NOT be set if DB write failed
    expect(cookiesSet).toHaveLength(0);
  });

  it("stores hashed token in DB and sends raw token in HttpOnly cookie", async () => {
    const { ctx, cookiesSet } = createMockContext(null);
    const mockUser = { id: 2, email: "persisted@example.com" } as any;

    let savedSession: any = null;
    db.setTestDb({
      insert: () => ({
        values: async (data: any) => {
          savedSession = data;
          return [{ insertId: 1 }];
        },
      }),
    });

    const { token } = await createSession(mockUser, ctx.req, ctx.res);

    expect(cookiesSet).toHaveLength(1);
    expect(cookiesSet[0].name).toBe(COOKIE_NAME);
    expect(cookiesSet[0].value).toBe(token);
    expect(cookiesSet[0].options.httpOnly).toBe(true);

    // Database should store hash of token, NOT raw token
    expect(savedSession).not.toBeNull();
    expect(savedSession.id).toBe(hashSessionToken(token));
    expect(savedSession.id).not.toBe(token);
  });
});

describe("Legacy Account Claim Security", () => {
  it("rejects claim attempt with missing verification token (fails closed)", async () => {
    const { ctx } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      (caller.auth.claimLegacyAccount as any)({
        email: "legacy@example.com",
        newPassword: "NewValidPassword123!",
      })
    ).rejects.toThrow();
  });

  it("rejects claim attempt with invalid verification token (403 Forbidden)", async () => {
    const { ctx } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    db.setTestDb({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: 5,
                email: "legacy@example.com",
                openId: "correct-legacy-token-secret",
                passwordHash: null,
                role: "user",
              },
            ],
          }),
        }),
      }),
    });

    await expect(
      caller.auth.claimLegacyAccount({
        email: "legacy@example.com",
        newPassword: "NewValidPassword123!",
        verificationToken: "attacker-wrong-token",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects claim attempt on account that already has password configured", async () => {
    const { ctx } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    db.setTestDb({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: 5,
                email: "legacy@example.com",
                openId: "valid-token",
                passwordHash: "already:configured:hash",
                role: "user",
              },
            ],
          }),
        }),
      }),
    });

    await expect(
      caller.auth.claimLegacyAccount({
        email: "legacy@example.com",
        newPassword: "NewValidPassword123!",
        verificationToken: "valid-token",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("successfully claims legacy account with valid verification token", async () => {
    const { ctx, cookiesSet } = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    let updatedPasswordHash: string | null = null;
    db.setTestDb({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: 5,
                email: "legacy@example.com",
                openId: "valid-token-12345",
                passwordHash: null,
                role: "user",
              },
            ],
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => {
          if (data.passwordHash) updatedPasswordHash = data.passwordHash;
          return {
            where: () => [{ affectedRows: 1 }],
          };
        },
      }),
      insert: () => ({
        values: () => [{ insertId: 1 }],
      }),
    });

    const result = await caller.auth.claimLegacyAccount({
      email: "legacy@example.com",
      newPassword: "NewValidPassword123!",
      verificationToken: "valid-token-12345",
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe("legacy@example.com");
    expect(updatedPasswordHash).not.toBeNull();
    expect(cookiesSet).toHaveLength(1);
  });
});

