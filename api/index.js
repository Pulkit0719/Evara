// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/services/auth.ts
import crypto2 from "node:crypto";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (process.env.NODE_ENV === "production") return true;
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite Lax protects against CSRF while allowing top-level navigation
    sameSite: "lax",
    secure
  };
}

// server/db.ts
import { and, asc, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email)
}));
var sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  userAgent: varchar("userAgent", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 })
}, (table) => ({
  userIdx: index("sessions_user_idx").on(table.userId),
  expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt)
}));
var userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("displayName", { length: 80 }).notNull(),
  typicalCycleLength: int("typicalCycleLength").notNull(),
  typicalPeriodDuration: int("typicalPeriodDuration").notNull(),
  lastPeriodStart: varchar("lastPeriodStart", { length: 10 }),
  trackingGoals: json("trackingGoals").$type().notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  userUnique: uniqueIndex("userProfiles_userId_unique").on(table.userId)
}));
var periodLogs = mysqlTable("periodLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }),
  flowIntensity: mysqlEnum("flowIntensity", ["light", "medium", "heavy"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  ownerStartIdx: index("periodLogs_owner_start_idx").on(table.userId, table.startDate),
  ownerStartUnique: uniqueIndex("periodLogs_owner_start_unique").on(table.userId, table.startDate)
}));
var symptomLogs = mysqlTable("symptomLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  logDate: varchar("logDate", { length: 10 }).notNull(),
  symptom: varchar("symptom", { length: 40 }).notNull(),
  severity: mysqlEnum("severity", ["mild", "moderate", "severe"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  ownerDateIdx: index("symptomLogs_owner_date_idx").on(table.userId, table.logDate)
}));
var wellnessLogs = mysqlTable("wellnessLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  logDate: varchar("logDate", { length: 10 }).notNull(),
  mood: int("mood"),
  energy: int("energy"),
  sleepHours: int("sleepHours"),
  waterGlasses: int("waterGlasses"),
  activityMinutes: int("activityMinutes"),
  stress: int("stress"),
  pain: int("pain"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  userDayUnique: uniqueIndex("wellnessLogs_user_date_unique").on(table.userId, table.logDate)
}));
var reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  reminderType: mysqlEnum("reminderType", ["period", "check_in", "medication", "appointment"]).notNull(),
  title: varchar("title", { length: 80 }).notNull(),
  scheduleTime: varchar("scheduleTime", { length: 5 }).notNull(),
  scheduleFrequency: mysqlEnum("scheduleFrequency", ["once", "daily", "monthly"]).notNull(),
  notificationPreview: varchar("notificationPreview", { length: 80 }).notNull().default("You have an Evara reminder."),
  isEnabled: int("isEnabled").notNull().default(1),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  ownerIdx: index("reminders_owner_idx").on(table.userId),
  taskUnique: uniqueIndex("reminders_task_uid_unique").on(table.scheduleCronTaskUid)
}));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "evara",
  sessionSecret: process.env.SESSION_SECRET ?? "evara-default-session-secret-key-change-me",
  cookieSecret: process.env.SESSION_SECRET ?? "evara-default-session-secret-key-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerUserId: process.env.OWNER_USER_ID ? parseInt(process.env.OWNER_USER_ID, 10) : void 0,
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Provider-independent AI configuration (OpenAI-compatible, Gemini, Groq, Ollama)
  aiProvider: (process.env.AI_PROVIDER || "openai").toLowerCase(),
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",
  // S3-compatible Object Storage
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  // Notifications (Webhook)
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  // Provider-independent Email Configuration (SMTP)
  emailProvider: process.env.EMAIL_PROVIDER ?? "smtp",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "noreply@evara.app"
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function database() {
  const db = await getDb();
  if (!db) throw new Error("The database is currently unavailable.");
  return db;
}
function isUserAdmin(user) {
  if (user.role === "admin") return true;
  if (ENV.ownerUserId && user.id === ENV.ownerUserId) return true;
  if (ENV.ownerEmail && user.email && user.email.toLowerCase() === ENV.ownerEmail.toLowerCase()) return true;
  if (ENV.ownerOpenId && user.openId && user.openId === ENV.ownerOpenId) return true;
  return false;
}
async function getUserById(id) {
  const db = await database();
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}
async function getUserByEmail(email) {
  const db = await database();
  const normalizedEmail = email.toLowerCase().trim();
  return (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
}
async function createUser(data) {
  const db = await database();
  const normalizedEmail = data.email.toLowerCase().trim();
  const openId = data.openId || `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const role = data.role ?? (isUserAdmin({ email: normalizedEmail, openId }) ? "admin" : "user");
  const loginMethod = data.loginMethod ?? "local";
  const result = await db.insert(users).values({
    openId,
    email: normalizedEmail,
    name: data.name ?? null,
    passwordHash: data.passwordHash ?? null,
    loginMethod,
    role,
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  const insertId = result[0].insertId;
  const created = await getUserById(insertId);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}
async function updateUserPassword(userId, passwordHash) {
  const db = await database();
  const result = await db.update(users).set({ passwordHash, loginMethod: "local", updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}
async function updateUserLastSignedIn(userId) {
  const db = await database();
  await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function createSessionRecord(session) {
  const db = await database();
  await db.insert(sessions).values({
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null
  });
}
async function getSessionRecord(id) {
  const db = await database();
  return (await db.select().from(sessions).where(eq(sessions.id, id)).limit(1))[0];
}
async function deleteSessionRecord(id) {
  const db = await database();
  const result = await db.delete(sessions).where(eq(sessions.id, id));
  return result[0].affectedRows > 0;
}
async function getProfile(userId) {
  const db = await database();
  return (await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1))[0] ?? null;
}
async function saveProfile(userId, values) {
  const db = await database();
  await db.insert(userProfiles).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values } });
  return getProfile(userId);
}
async function getPeriodLogs(userId) {
  const db = await database();
  return db.select().from(periodLogs).where(eq(periodLogs.userId, userId)).orderBy(desc(periodLogs.startDate));
}
async function periodStartExists(userId, startDate, excludingId) {
  const db = await database();
  const filters = [eq(periodLogs.userId, userId), eq(periodLogs.startDate, startDate)];
  if (excludingId) filters.push(ne(periodLogs.id, excludingId));
  return (await db.select({ id: periodLogs.id }).from(periodLogs).where(and(...filters)).limit(1)).length > 0;
}
async function createPeriodLog(userId, values) {
  const db = await database();
  const result = await db.insert(periodLogs).values({ userId, ...values });
  return { id: result[0].insertId };
}
async function updatePeriodLog(userId, id, values) {
  const db = await database();
  const result = await db.update(periodLogs).set(values).where(and(eq(periodLogs.id, id), eq(periodLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function deletePeriodLog(userId, id) {
  const db = await database();
  const result = await db.delete(periodLogs).where(and(eq(periodLogs.id, id), eq(periodLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function getSymptomLogs(userId) {
  const db = await database();
  return db.select().from(symptomLogs).where(eq(symptomLogs.userId, userId)).orderBy(desc(symptomLogs.logDate));
}
async function createSymptomLog(userId, values) {
  const db = await database();
  const result = await db.insert(symptomLogs).values({ userId, ...values });
  return { id: result[0].insertId };
}
async function updateSymptomLog(userId, id, values) {
  const db = await database();
  const result = await db.update(symptomLogs).set(values).where(and(eq(symptomLogs.id, id), eq(symptomLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function deleteSymptomLog(userId, id) {
  const db = await database();
  const result = await db.delete(symptomLogs).where(and(eq(symptomLogs.id, id), eq(symptomLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function getWellnessLogs(userId) {
  const db = await database();
  return db.select().from(wellnessLogs).where(eq(wellnessLogs.userId, userId)).orderBy(desc(wellnessLogs.logDate));
}
async function saveWellnessLog(userId, values) {
  const db = await database();
  await db.insert(wellnessLogs).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values } });
  return { success: true };
}
async function deleteWellnessLog(userId, id) {
  const db = await database();
  const result = await db.delete(wellnessLogs).where(and(eq(wellnessLogs.id, id), eq(wellnessLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function getReminders(userId) {
  const db = await database();
  return db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.scheduleTime));
}
async function createReminder(userId, values) {
  const db = await database();
  const result = await db.insert(reminders).values({ userId, ...values, isEnabled: values.isEnabled ? 1 : 0, notificationPreview: "You have an Evara reminder." });
  return { id: result[0].insertId };
}
async function updateReminder(userId, id, values) {
  const db = await database();
  const result = await db.update(reminders).set({ ...values, isEnabled: values.isEnabled ? 1 : 0, notificationPreview: "You have an Evara reminder." }).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function deleteReminder(userId, id) {
  const db = await database();
  const result = await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return { success: result[0].affectedRows > 0 };
}
async function getCalendarRecords(userId, month) {
  const db = await database();
  const start = `${month}-01`;
  const end = `${month}-31`;
  const [periods, symptoms2, wellness] = await Promise.all([
    db.select().from(periodLogs).where(and(eq(periodLogs.userId, userId), or(
      and(lte(periodLogs.startDate, end), gte(periodLogs.endDate, start)),
      and(lte(periodLogs.startDate, end), isNull(periodLogs.endDate))
    ))),
    db.select().from(symptomLogs).where(and(eq(symptomLogs.userId, userId), gte(symptomLogs.logDate, start), lte(symptomLogs.logDate, end))),
    db.select().from(wellnessLogs).where(and(eq(wellnessLogs.userId, userId), gte(wellnessLogs.logDate, start), lte(wellnessLogs.logDate, end)))
  ]);
  return { periods, symptoms: symptoms2, wellness };
}
async function clearHealthData(userId) {
  const db = await database();
  await Promise.all([
    db.delete(periodLogs).where(eq(periodLogs.userId, userId)),
    db.delete(symptomLogs).where(eq(symptomLogs.userId, userId)),
    db.delete(wellnessLogs).where(eq(wellnessLogs.userId, userId)),
    db.delete(reminders).where(eq(reminders.userId, userId))
  ]);
}
async function deleteUserAccount(userId) {
  const db = await database();
  const result = await db.delete(users).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}

// server/services/auth.ts
var scryptAsync = promisify(crypto2.scrypt);
var SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1e3;
var rateLimitMap = /* @__PURE__ */ new Map();
var MAX_ATTEMPTS = 10;
var WINDOW_MS = 15 * 60 * 1e3;
function checkAuthRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    } else if (entry.count >= MAX_ATTEMPTS) {
      const waitMinutes = Math.ceil((entry.resetAt - now) / 6e4);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many authentication attempts. Please try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`
      });
    }
  }
}
function recordAuthAttempt(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}
function resetAuthRateLimit(ip) {
  rateLimitMap.delete(ip);
}
function hashSessionToken(token) {
  return crypto2.createHash("sha256").update(token).digest("hex");
}
async function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Password must be at least 8 characters long."
    });
  }
  const salt = crypto2.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}
async function verifyPassword(password, combinedHash) {
  if (!password || !combinedHash) return false;
  const parts = combinedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, storedHashHex] = parts;
  try {
    const derivedKey = await scryptAsync(password, salt, 64);
    const storedHash = Buffer.from(storedHashHex, "hex");
    if (derivedKey.length !== storedHash.length) return false;
    return crypto2.timingSafeEqual(derivedKey, storedHash);
  } catch {
    return false;
  }
}
async function createSession(user, req, res) {
  const token = crypto2.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const userAgent = (req.headers["user-agent"] ?? "").slice(0, 255);
  const ipAddress = (req.ip || req.headers["x-forwarded-for"] || "").slice(0, 45);
  try {
    await createSessionRecord({
      id: tokenHash,
      userId: user.id,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null
    });
  } catch (error) {
    console.error("[Auth] Failed to persist session to database:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Authentication failed closed because session persistence failed."
    });
  }
  const cookieOptions = {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_DURATION_MS
  };
  res.cookie(COOKIE_NAME, token, cookieOptions);
  return { token, expiresAt };
}
async function revokeSession(token, req, res) {
  if (token) {
    try {
      const tokenHash = hashSessionToken(token);
      await deleteSessionRecord(tokenHash);
    } catch (error) {
      console.warn("[Auth] Failed to delete session from database:", error);
    }
  }
  res.clearCookie(COOKIE_NAME, {
    ...getSessionCookieOptions(req),
    maxAge: -1
  });
}
async function authenticateRequest(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
  if (!token) return null;
  try {
    const tokenHash = hashSessionToken(token);
    const session = await getSessionRecord(tokenHash);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await deleteSessionRecord(tokenHash);
      return null;
    }
    const user = await getUserById(session.userId);
    if (!user) return null;
    if (isUserAdmin(user) && user.role !== "admin") {
      user.role = "admin";
    }
    return user;
  } catch (error) {
    return null;
  }
}
function sanitizeUser(user) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// server/storage.ts
import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var LOCAL_STORAGE_DIR = path.resolve(process.cwd(), ".storage", "uploads");
function isS3Configured() {
  return Boolean(
    ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey
  );
}
var _s3Client = null;
function getS3Client() {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: ENV.s3Region || "us-east-1",
      endpoint: ENV.s3Endpoint || void 0,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey
      },
      // Force path style when using MinIO or custom local S3 endpoints
      forcePathStyle: Boolean(ENV.s3Endpoint)
    });
  }
  return _s3Client;
}
function normalizeKey(relKey) {
  const cleaned = relKey.replace(/^\/+/, "").replace(/\.\./g, "");
  return path.normalize(cleaned).replace(/\\/g, "/");
}
async function storageGetSignedUrl(relKey, expiresInSeconds = 3600) {
  const key = normalizeKey(relKey);
  if (isS3Configured()) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }
  return `/api/storage/${key}`;
}
async function getLocalStorageFile(key) {
  const normalized = normalizeKey(key);
  const safePath = path.resolve(LOCAL_STORAGE_DIR, normalized);
  if (!safePath.startsWith(LOCAL_STORAGE_DIR)) {
    return null;
  }
  if (!fs.existsSync(safePath)) {
    return null;
  }
  const buffer = await fs.promises.readFile(safePath);
  let contentType = "application/octet-stream";
  const metaPath = `${safePath}.meta.json`;
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
      if (meta.contentType) contentType = meta.contentType;
    } catch {
    }
  }
  return { buffer, contentType };
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/api/storage/*", async (req, res) => {
    const rawKey = req.params[0] || "";
    if (!rawKey) {
      res.status(400).send("Storage key is required.");
      return;
    }
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).send("Unauthorized: Authentication required.");
        return;
      }
      const segments = rawKey.split("/").filter(Boolean);
      let targetUserId = null;
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

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.notificationWebhookUrl) {
    console.info(`[Notification] (No webhook configured) Title: "${title}" | Content: "${content}"`);
    return true;
  }
  try {
    const response = await fetch(ENV.notificationWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        content,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      })
    });
    if (!response.ok) {
      console.warn(`[Notification] Webhook returned status ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error dispatching webhook:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError3 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/auth.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z2 } from "zod";
var authRouter = router({
  /**
   * Retrieves the currently authenticated user, or null if unauthenticated.
   * Excludes sensitive fields such as passwordHash.
   */
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ? sanitizeUser(ctx.user) : null;
  }),
  /**
   * Registers a new local account with email and password.
   */
  register: publicProcedure.input(
    z2.object({
      email: z2.string().email("Please provide a valid email address.").max(320),
      password: z2.string().min(8, "Password must be at least 8 characters long."),
      name: z2.string().max(120).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const clientIp = (ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "127.0.0.1").split(",")[0].trim();
    checkAuthRateLimit(clientIp);
    const existingUser = await getUserByEmail(input.email);
    if (existingUser) {
      recordAuthAttempt(clientIp);
      throw new TRPCError4({
        code: "CONFLICT",
        message: "An account with this email address already exists. Please sign in or claim your legacy account."
      });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await createUser({
      email: input.email,
      passwordHash,
      name: input.name?.trim() || null,
      loginMethod: "local"
    });
    resetAuthRateLimit(clientIp);
    await createSession(user, ctx.req, ctx.res);
    return {
      user: sanitizeUser(user)
    };
  }),
  /**
   * Authenticates a user with email and password, establishing a secure session cookie.
   */
  login: publicProcedure.input(
    z2.object({
      email: z2.string().email("Please provide a valid email address."),
      password: z2.string().min(1, "Password is required.")
    })
  ).mutation(async ({ input, ctx }) => {
    const clientIp = (ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "127.0.0.1").split(",")[0].trim();
    checkAuthRateLimit(clientIp);
    const user = await getUserByEmail(input.email);
    if (!user) {
      recordAuthAttempt(clientIp);
      throw new TRPCError4({
        code: "UNAUTHORIZED",
        message: "Invalid email or password."
      });
    }
    if (!user.passwordHash) {
      recordAuthAttempt(clientIp);
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "This account was registered using legacy OAuth. Please set a password using the 'Claim Legacy Account' option."
      });
    }
    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      recordAuthAttempt(clientIp);
      throw new TRPCError4({
        code: "UNAUTHORIZED",
        message: "Invalid email or password."
      });
    }
    resetAuthRateLimit(clientIp);
    await updateUserLastSignedIn(user.id);
    await createSession(user, ctx.req, ctx.res);
    return {
      user: sanitizeUser(user)
    };
  }),
  /**
   * Public legacy account claiming is retired for production security.
   * All legacy account password setups are handled through verified administrator migration.
   */
  claimLegacyAccount: publicProcedure.input(
    z2.object({
      email: z2.string().email().optional(),
      newPassword: z2.string().optional(),
      verificationToken: z2.string().optional(),
      openId: z2.string().optional()
    })
  ).mutation(async () => {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: "Public legacy account claiming has been retired for production security. Please contact your system administrator for verified account migration."
    });
  }),
  /**
   * Administrator-controlled account migration.
   * Allows an authenticated administrator to set or reset a local password for a verified user.
   */
  adminSetUserPassword: adminProcedure.input(
    z2.object({
      userId: z2.number().int().positive(),
      newPassword: z2.string().min(8, "Password must be at least 8 characters long.")
    })
  ).mutation(async ({ input }) => {
    const user = await getUserById(input.userId);
    if (!user) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "User not found."
      });
    }
    const passwordHash = await hashPassword(input.newPassword);
    await updateUserPassword(user.id, passwordHash);
    return {
      success: true,
      user: sanitizeUser(user)
    };
  }),
  /**
   * Logs out the user by revoking the session token and clearing the session cookie.
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieHeader = ctx.req.headers.cookie;
    let token;
    if (cookieHeader) {
      const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
      if (match) {
        token = decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
      }
    }
    await revokeSession(token, ctx.req, ctx.res);
    return { success: true };
  })
});

// server/routers/calendar.ts
import { z as z4 } from "zod";

// server/lib/evara.ts
import { z as z3 } from "zod";
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var dateSchema = z3.string().regex(DATE_PATTERN, "Use a valid calendar date.").refine((value) => {
  const parsed = /* @__PURE__ */ new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date.");
var timeSchema = z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
var symptoms = [
  "cramps",
  "bloating",
  "headache",
  "back pain",
  "breast tenderness",
  "acne",
  "nausea",
  "fatigue",
  "mood changes",
  "food cravings",
  "sleep issues"
];
var symptomSchema = z3.enum(symptoms);
var severitySchema = z3.enum(["mild", "moderate", "severe"]);
var flowSchema = z3.enum(["light", "medium", "heavy"]);
var reminderTypeSchema = z3.enum(["period", "check_in", "medication", "appointment"]);
var reminderFrequencySchema = z3.enum(["once", "daily", "monthly"]);
var millisecondsPerDay = 24 * 60 * 60 * 1e3;
function parseDay(value) {
  return /* @__PURE__ */ new Date(`${value}T12:00:00.000Z`);
}
function toDayString(value) {
  return value.toISOString().slice(0, 10);
}
function daysBetween(startDate, endDate) {
  return Math.round((parseDay(endDate).getTime() - parseDay(startDate).getTime()) / millisecondsPerDay);
}
function addDays(date, days) {
  const result = parseDay(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toDayString(result);
}
function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
}
function calculateCycleSummary(periods, fallbackCycleLength) {
  const chronological = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cycleLengths = chronological.slice(1).map(
    (period, index2) => daysBetween(chronological[index2].startDate, period.startDate)
  ).filter((length) => length > 0 && length <= 90);
  const periodDurations = chronological.filter((period) => period.endDate).map((period) => daysBetween(period.startDate, period.endDate) + 1).filter((length) => length > 0 && length <= 21);
  const averageCycleLength = average(cycleLengths) ?? fallbackCycleLength;
  const averagePeriodDuration = average(periodDurations);
  const cycleVariation = cycleLengths.length > 1 ? Math.max(...cycleLengths) - Math.min(...cycleLengths) : null;
  const latestPeriod = chronological.at(-1) ?? null;
  return {
    averageCycleLength,
    averagePeriodDuration,
    cycleVariation,
    cycleLengths,
    latestPeriodStart: latestPeriod?.startDate ?? null,
    estimatedNextPeriod: latestPeriod && averageCycleLength ? addDays(latestPeriod.startDate, Math.round(averageCycleLength)) : null
  };
}
function phaseForDate(day, latestPeriodStart, cycleLength) {
  if (!latestPeriodStart || !cycleLength) return null;
  const dayOffset = daysBetween(latestPeriodStart, day);
  if (dayOffset < 0) return null;
  const cycleDay = dayOffset % Math.round(cycleLength);
  if (cycleDay <= 5) return "Period";
  if (cycleDay <= Math.round(cycleLength * 0.45)) return "Follicular";
  if (cycleDay <= Math.round(cycleLength * 0.58)) return "Ovulation window";
  return "Luteal";
}

// server/routers/calendar.ts
var calendarRouter = router({
  month: protectedProcedure.input(z4.object({ month: z4.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const [records, periods, profile] = await Promise.all([
      getCalendarRecords(ctx.user.id, input.month),
      getPeriodLogs(ctx.user.id),
      getProfile(ctx.user.id)
    ]);
    const cycle = calculateCycleSummary(periods, profile?.typicalCycleLength ?? null);
    const phaseByDay = {};
    for (let day = 1; day <= 31; day += 1) {
      const dayString = `${input.month}-${String(day).padStart(2, "0")}`;
      const parsed = /* @__PURE__ */ new Date(`${dayString}T12:00:00.000Z`);
      if (parsed.getUTCMonth() + 1 !== Number(input.month.slice(5))) continue;
      phaseByDay[dayString] = phaseForDate(dayString, cycle.latestPeriodStart, cycle.averageCycleLength);
    }
    const estimatedPeriodDays = cycle.estimatedNextPeriod ? Array.from(
      { length: Math.max(1, Math.round(cycle.averagePeriodDuration ?? profile?.typicalPeriodDuration ?? 1)) },
      (_, index2) => addDays(cycle.estimatedNextPeriod, index2)
    ) : [];
    return { ...records, estimatedNextPeriod: cycle.estimatedNextPeriod, estimatedPeriodDays, phaseByDay };
  })
});

// server/routers/insights.ts
var insightsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [profile, periods, symptomLogs2, wellnessLogs2] = await Promise.all([
      getProfile(ctx.user.id),
      getPeriodLogs(ctx.user.id),
      getSymptomLogs(ctx.user.id),
      getWellnessLogs(ctx.user.id)
    ]);
    const cycle = calculateCycleSummary(periods, profile?.typicalCycleLength ?? null);
    const symptomCounts = symptomLogs2.reduce((counts, log) => {
      counts[log.symptom] = (counts[log.symptom] ?? 0) + 1;
      return counts;
    }, {});
    const symptomFrequency = Object.entries(symptomCounts).map(([symptom, count]) => ({ symptom, count })).sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
    const timing = cycle.latestPeriodStart ? symptomLogs2.map((log) => ({
      symptom: log.symptom,
      logDate: log.logDate,
      daysFromLatestPeriod: daysBetween(cycle.latestPeriodStart, log.logDate)
    })) : [];
    const wellnessTrend = wellnessLogs2.slice(0, 7).reverse().map((log) => ({
      logDate: log.logDate,
      mood: log.mood,
      sleepHours: log.sleepHours,
      pain: log.pain
    }));
    return {
      cycle,
      symptomFrequency,
      symptomTiming: timing,
      wellnessTrend,
      recordedAverages: {
        mood: average(wellnessLogs2.map((log) => log.mood).filter((value) => value !== null)),
        sleepHours: average(wellnessLogs2.map((log) => log.sleepHours).filter((value) => value !== null)),
        pain: average(wellnessLogs2.map((log) => log.pain).filter((value) => value !== null))
      },
      dataPoints: {
        periods: periods.length,
        symptoms: symptomLogs2.length,
        wellness: wellnessLogs2.length
      }
    };
  })
});

// server/routers/periods.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
var periodInput = z5.object({
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  flowIntensity: flowSchema,
  notes: z5.string().trim().max(500).nullable()
}).refine((input) => !input.endDate || input.endDate >= input.startDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"]
});
var periodsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getPeriodLogs(ctx.user.id)),
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [logs, profile] = await Promise.all([getPeriodLogs(ctx.user.id), getProfile(ctx.user.id)]);
    return calculateCycleSummary(logs, profile?.typicalCycleLength ?? null);
  }),
  create: protectedProcedure.input(periodInput).mutation(async ({ ctx, input }) => {
    if (await periodStartExists(ctx.user.id, input.startDate)) {
      throw new TRPCError5({ code: "CONFLICT", message: "You already have a period entry starting on this date." });
    }
    return createPeriodLog(ctx.user.id, input);
  }),
  update: protectedProcedure.input(periodInput.safeExtend({ id: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    if (await periodStartExists(ctx.user.id, values.startDate, id)) {
      throw new TRPCError5({ code: "CONFLICT", message: "You already have a period entry starting on this date." });
    }
    const result = await updatePeriodLog(ctx.user.id, id, values);
    if (!result.success) throw new TRPCError5({ code: "NOT_FOUND", message: "This period record is no longer available." });
    return result;
  }),
  delete: protectedProcedure.input(z5.object({ id: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const result = await deletePeriodLog(ctx.user.id, input.id);
    if (!result.success) throw new TRPCError5({ code: "NOT_FOUND", message: "This period record is no longer available." });
    return result;
  })
});

// server/routers/profile.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z6 } from "zod";
var profileInput = z6.object({
  displayName: z6.string().trim().min(2, "Enter the name you would like Evara to use.").max(80),
  typicalCycleLength: z6.number().int().min(20).max(45),
  typicalPeriodDuration: z6.number().int().min(2).max(10),
  lastPeriodStart: dateSchema.nullable(),
  trackingGoals: z6.array(z6.string().trim().min(1).max(48)).min(1, "Choose at least one tracking goal.").max(5)
});
var profileRouter = router({
  get: protectedProcedure.query(({ ctx }) => getProfile(ctx.user.id)),
  save: protectedProcedure.input(profileInput).mutation(
    ({ ctx, input }) => saveProfile(ctx.user.id, input)
  ),
  clearHealthData: protectedProcedure.input(z6.object({ confirmation: z6.literal("DELETE") })).mutation(async ({ ctx }) => {
    await clearHealthData(ctx.user.id);
    return { success: true };
  }),
  deleteAccount: protectedProcedure.input(z6.object({ confirmation: z6.literal("DELETE") })).mutation(async ({ ctx }) => {
    const deleted = await deleteUserAccount(ctx.user.id);
    if (!deleted) throw new TRPCError6({ code: "NOT_FOUND", message: "This account is no longer available." });
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true };
  })
});

// server/routers/reminders.ts
import { z as z7 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
var reminderInput = z7.object({
  reminderType: reminderTypeSchema,
  title: z7.string().trim().min(2, "Give this reminder a short name.").max(80),
  scheduleTime: timeSchema,
  scheduleFrequency: reminderFrequencySchema,
  isEnabled: z7.boolean()
});
var remindersRouter = router({
  list: protectedProcedure.query(({ ctx }) => getReminders(ctx.user.id)),
  create: protectedProcedure.input(reminderInput).mutation(({ ctx, input }) => createReminder(ctx.user.id, input)),
  update: protectedProcedure.input(reminderInput.extend({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    const result = await updateReminder(ctx.user.id, id, values);
    if (!result.success) throw new TRPCError7({ code: "NOT_FOUND", message: "This reminder preference is no longer available." });
    return result;
  }),
  delete: protectedProcedure.input(z7.object({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const result = await deleteReminder(ctx.user.id, input.id);
    if (!result.success) throw new TRPCError7({ code: "NOT_FOUND", message: "This reminder preference is no longer available." });
    return result;
  })
});

// server/routers/reports.ts
function threeMonthsAgo() {
  const date = /* @__PURE__ */ new Date();
  date.setUTCMonth(date.getUTCMonth() - 3);
  return date.toISOString().slice(0, 10);
}
async function getOwnedHealthData(userId) {
  const [profile, periods, symptoms2, wellness, reminderPreferences] = await Promise.all([
    getProfile(userId),
    getPeriodLogs(userId),
    getSymptomLogs(userId),
    getWellnessLogs(userId),
    getReminders(userId)
  ]);
  return { profile, periods, symptoms: symptoms2, wellness, reminderPreferences };
}
function withoutOwnerId(record) {
  const { userId: _userId, ...safeRecord } = record;
  return safeRecord;
}
function exportableData(data) {
  const profile = data.profile ? withoutOwnerId(data.profile) : null;
  const reminderPreferences = data.reminderPreferences.map((reminder) => {
    const { userId: _userId, scheduleCronTaskUid: _taskUid, ...safeReminder } = reminder;
    return safeReminder;
  });
  return {
    profile,
    periods: data.periods.map(withoutOwnerId),
    symptoms: data.symptoms.map(withoutOwnerId),
    wellness: data.wellness.map(withoutOwnerId),
    reminderPreferences
  };
}
var reportsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const data = await getOwnedHealthData(ctx.user.id);
    const rangeStart = threeMonthsAgo();
    const periods = data.periods.filter((log) => log.startDate >= rangeStart || log.endDate && log.endDate >= rangeStart);
    const symptoms2 = data.symptoms.filter((log) => log.logDate >= rangeStart);
    const wellness = data.wellness.filter((log) => log.logDate >= rangeStart);
    const symptomFrequency = Object.entries(symptoms2.reduce((counts, log) => {
      counts[log.symptom] = (counts[log.symptom] ?? 0) + 1;
      return counts;
    }, {})).map(([symptom, count]) => ({ symptom, count })).sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
    const cycle = calculateCycleSummary(periods, data.profile?.typicalCycleLength ?? null);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      rangeStart,
      profile: data.profile ? { displayName: data.profile.displayName } : null,
      cycle: { ...cycle, recentCycleLengths: cycle.cycleLengths.slice(-3) },
      symptomFrequency,
      wellnessAverages: {
        mood: average(wellness.map((log) => log.mood).filter((value) => value !== null)),
        pain: average(wellness.map((log) => log.pain).filter((value) => value !== null)),
        sleepHours: average(wellness.map((log) => log.sleepHours).filter((value) => value !== null))
      },
      recentPeriods: periods.slice(0, 6).map(withoutOwnerId),
      recordCounts: { periods: periods.length, symptoms: symptoms2.length, wellness: wellness.length }
    };
  }),
  exportData: protectedProcedure.mutation(async ({ ctx }) => ({ schemaVersion: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), data: exportableData(await getOwnedHealthData(ctx.user.id)) }))
});

// server/routers/tracking.ts
import { z as z8 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
var symptomInput = z8.object({
  logDate: dateSchema,
  symptom: symptomSchema,
  severity: severitySchema,
  notes: z8.string().trim().max(500).nullable()
});
var wellbeingScore = z8.number().int().min(1).max(5).nullable();
var wellnessInput = z8.object({
  logDate: dateSchema,
  mood: wellbeingScore,
  energy: wellbeingScore,
  sleepHours: z8.number().int().min(0).max(18).nullable(),
  waterGlasses: z8.number().int().min(0).max(30).nullable(),
  activityMinutes: z8.number().int().min(0).max(1440).nullable(),
  stress: wellbeingScore,
  pain: wellbeingScore,
  notes: z8.string().trim().max(750).nullable()
}).refine((input) => Object.entries(input).some(([key, value]) => key !== "logDate" && value !== null), {
  message: "Add at least one check-in detail before saving."
});
var trackingRouter = router({
  symptoms: router({
    list: protectedProcedure.query(({ ctx }) => getSymptomLogs(ctx.user.id)),
    create: protectedProcedure.input(symptomInput).mutation(({ ctx, input }) => createSymptomLog(ctx.user.id, input)),
    update: protectedProcedure.input(symptomInput.extend({ id: z8.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const result = await updateSymptomLog(ctx.user.id, id, values);
      if (!result.success) throw new TRPCError8({ code: "NOT_FOUND", message: "This symptom record is no longer available." });
      return result;
    }),
    delete: protectedProcedure.input(z8.object({ id: z8.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await deleteSymptomLog(ctx.user.id, input.id);
      if (!result.success) throw new TRPCError8({ code: "NOT_FOUND", message: "This symptom record is no longer available." });
      return result;
    })
  }),
  wellness: router({
    list: protectedProcedure.query(({ ctx }) => getWellnessLogs(ctx.user.id)),
    save: protectedProcedure.input(wellnessInput).mutation(({ ctx, input }) => saveWellnessLog(ctx.user.id, input)),
    delete: protectedProcedure.input(z8.object({ id: z8.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await deleteWellnessLog(ctx.user.id, input.id);
      if (!result.success) throw new TRPCError8({ code: "NOT_FOUND", message: "This daily check-in is no longer available." });
      return result;
    })
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: authRouter,
  profile: profileRouter,
  periods: periodsRouter,
  tracking: trackingRouter,
  calendar: calendarRouter,
  insights: insightsRouter,
  reminders: remindersRouter,
  reports: reportsRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createExpressApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use((req, _res, next) => {
    if (req.originalUrl && req.url !== req.originalUrl) {
      req.url = req.originalUrl;
    }
    next();
  });
  app2.use((_req, res, next) => {
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
  app2.use("/api", (req, res, next) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const origin = req.headers.origin;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
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
  app2.use(express.json({ limit: "10mb" }));
  app2.use(express.urlencoded({ limit: "10mb", extended: true }));
  app2.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/readyz", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({
          status: "degraded",
          database: "not_configured",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        return;
      }
      await db.execute(sql`SELECT 1`);
      res.status(200).json({
        status: "ready",
        database: "connected",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        message: error?.message || "Database connectivity check failed",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  registerStorageProxy(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server.ts
var app = createExpressApp();
var server_default = app;
export {
  server_default as default
};
