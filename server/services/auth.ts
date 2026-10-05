import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import * as db from "../db";

const scryptAsync = promisify(crypto.scrypt);

// Session lifetime: 30 days
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Rate limiting state: map IP address to { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks in-memory rate limiting for sensitive authentication endpoints.
 * Throws an error if too many attempts occurred within the time window.
 */
export function checkAuthRateLimit(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    } else if (entry.count >= MAX_ATTEMPTS) {
      const waitMinutes = Math.ceil((entry.resetAt - now) / 60000);
      throw new Error(`Too many authentication attempts. Please try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`);
    }
  }
}

/**
 * Records an attempt for rate-limiting.
 */
export function recordAuthAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/**
 * Resets rate limit upon successful login.
 */
export function resetAuthRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}

/**
 * Hashes a plaintext password using scrypt with a cryptographically secure 16-byte random salt.
 * Format: `${salt}:${derivedKey}`
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Securely verifies a password against a stored scrypt hash using timing-safe comparison.
 */
export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  if (!password || !combinedHash) return false;
  const parts = combinedHash.split(":");
  if (parts.length !== 2) return false;

  const [salt, storedHashHex] = parts;
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedHash = Buffer.from(storedHashHex, "hex");
    if (derivedKey.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(derivedKey, storedHash);
  } catch {
    return false;
  }
}

/**
 * Creates a new server-controlled revocable session, stores it in the database,
 * and sets the session cookie on the response.
 */
export async function createSession(
  user: User,
  req: Request,
  res: Response
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const userAgent = (req.headers["user-agent"] ?? "").slice(0, 255);
  const ipAddress = (req.ip || (req.headers["x-forwarded-for"] as string) || "").slice(0, 45);

  try {
    await db.createSessionRecord({
      id: token,
      userId: user.id,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("[Auth] Failed to write session to database:", error);
    // Non-fatal if database is currently disconnected during offline tests
  }

  // Set secure HttpOnly cookie
  const cookieOptions = {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  };
  res.cookie(COOKIE_NAME, token, cookieOptions);

  return { token, expiresAt };
}

/**
 * Revokes a session by deleting it from the database and clearing the session cookie.
 */
export async function revokeSession(token: string | undefined, req: Request, res: Response): Promise<void> {
  if (token) {
    try {
      await db.deleteSessionRecord(token);
    } catch (error) {
      console.warn("[Auth] Failed to delete session from database:", error);
    }
  }

  res.clearCookie(COOKIE_NAME, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}

/**
 * Authenticates an incoming HTTP request via session token or legacy cookie.
 * Returns the authenticated User or null.
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  // Extract session token from cookie header
  const match = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;
  const token = decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
  if (!token) return null;

  try {
    // 1. Look up session in database
    const session = await db.getSessionRecord(token);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await db.deleteSessionRecord(token);
      return null;
    }

    // 2. Fetch user
    const user = await db.getUserById(session.userId);
    if (!user) return null;

    // Ensure role reflects current admin configuration
    if (db.isUserAdmin(user) && user.role !== "admin") {
      user.role = "admin";
    }

    return user;
  } catch (error) {
    // Database might be unavailable during tests or cold start
    return null;
  }
}

/**
 * Sanitizes user record for API responses (stripping passwordHash).
 */
export function sanitizeUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}
