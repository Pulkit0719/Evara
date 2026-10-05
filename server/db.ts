import { and, asc, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  periodLogs,
  reminders,
  sessions,
  type Session,
  symptomLogs,
  type User,
  type UserProfile,
  userProfiles,
  users,
  wellnessLogs,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

export function setTestDb(mockDb: any) {
  _db = mockDb;
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("The database is currently unavailable.");
  return db;
}

export function isUserAdmin(user: { id?: number; email?: string | null; openId?: string | null; role?: string }): boolean {
  if (user.role === "admin") return true;
  if (ENV.ownerUserId && user.id === ENV.ownerUserId) return true;
  if (ENV.ownerEmail && user.email && user.email.toLowerCase() === ENV.ownerEmail.toLowerCase()) return true;
  if (ENV.ownerOpenId && user.openId && user.openId === ENV.ownerOpenId) return true;
  return false;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await database();
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod", "passwordHash"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (isUserAdmin({ openId: user.openId, email: user.email }) ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await database();
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await database();
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await database();
  const normalizedEmail = email.toLowerCase().trim();
  return (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
}

export async function createUser(data: {
  email: string;
  passwordHash?: string | null;
  name?: string | null;
  openId?: string;
  role?: "user" | "admin";
  loginMethod?: string;
}): Promise<User> {
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
    lastSignedIn: new Date(),
  });

  const insertId = result[0].insertId;
  const created = await getUserById(insertId);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
  const db = await database();
  const result = await db
    .update(users)
    .set({ passwordHash, loginMethod: "local", updatedAt: new Date() })
    .where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}

export async function updateUserLastSignedIn(userId: number): Promise<void> {
  const db = await database();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function createSessionRecord(session: {
  id: string;
  userId: number;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  const db = await database();
  await db.insert(sessions).values({
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
  });
}

export async function getSessionRecord(id: string): Promise<Session | undefined> {
  const db = await database();
  return (await db.select().from(sessions).where(eq(sessions.id, id)).limit(1))[0];
}

export async function deleteSessionRecord(id: string): Promise<boolean> {
  const db = await database();
  const result = await db.delete(sessions).where(eq(sessions.id, id));
  return result[0].affectedRows > 0;
}

export async function deleteSessionsByUserId(userId: number): Promise<void> {
  const db = await database();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getProfile(userId: number): Promise<UserProfile | null> {
  const db = await database();
  return (await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1))[0] ?? null;
}

export async function saveProfile(userId: number, values: {
  displayName: string; typicalCycleLength: number; typicalPeriodDuration: number; lastPeriodStart: string | null; trackingGoals: string[];
}) {
  const db = await database();
  await db.insert(userProfiles).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values } });
  return getProfile(userId);
}

export async function getPeriodLogs(userId: number) {
  const db = await database();
  return db.select().from(periodLogs).where(eq(periodLogs.userId, userId)).orderBy(desc(periodLogs.startDate));
}

export async function periodStartExists(userId: number, startDate: string, excludingId?: number) {
  const db = await database();
  const filters = [eq(periodLogs.userId, userId), eq(periodLogs.startDate, startDate)];
  if (excludingId) filters.push(ne(periodLogs.id, excludingId));
  return (await db.select({ id: periodLogs.id }).from(periodLogs).where(and(...filters)).limit(1)).length > 0;
}

export async function createPeriodLog(userId: number, values: {
  startDate: string; endDate: string | null; flowIntensity: "light" | "medium" | "heavy"; notes: string | null;
}) {
  const db = await database();
  const result = await db.insert(periodLogs).values({ userId, ...values });
  return { id: result[0].insertId };
}

export async function updatePeriodLog(userId: number, id: number, values: {
  startDate: string; endDate: string | null; flowIntensity: "light" | "medium" | "heavy"; notes: string | null;
}) {
  const db = await database();
  const result = await db.update(periodLogs).set(values).where(and(eq(periodLogs.id, id), eq(periodLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function deletePeriodLog(userId: number, id: number) {
  const db = await database();
  const result = await db.delete(periodLogs).where(and(eq(periodLogs.id, id), eq(periodLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function getSymptomLogs(userId: number) {
  const db = await database();
  return db.select().from(symptomLogs).where(eq(symptomLogs.userId, userId)).orderBy(desc(symptomLogs.logDate));
}

export async function createSymptomLog(userId: number, values: {
  logDate: string; symptom: string; severity: "mild" | "moderate" | "severe"; notes: string | null;
}) {
  const db = await database();
  const result = await db.insert(symptomLogs).values({ userId, ...values });
  return { id: result[0].insertId };
}

export async function updateSymptomLog(userId: number, id: number, values: {
  logDate: string; symptom: string; severity: "mild" | "moderate" | "severe"; notes: string | null;
}) {
  const db = await database();
  const result = await db.update(symptomLogs).set(values).where(and(eq(symptomLogs.id, id), eq(symptomLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function deleteSymptomLog(userId: number, id: number) {
  const db = await database();
  const result = await db.delete(symptomLogs).where(and(eq(symptomLogs.id, id), eq(symptomLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function getWellnessLogs(userId: number) {
  const db = await database();
  return db.select().from(wellnessLogs).where(eq(wellnessLogs.userId, userId)).orderBy(desc(wellnessLogs.logDate));
}

export async function saveWellnessLog(userId: number, values: {
  logDate: string; mood: number | null; energy: number | null; sleepHours: number | null; waterGlasses: number | null;
  activityMinutes: number | null; stress: number | null; pain: number | null; notes: string | null;
}) {
  const db = await database();
  await db.insert(wellnessLogs).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values } });
  return { success: true } as const;
}

export async function deleteWellnessLog(userId: number, id: number) {
  const db = await database();
  const result = await db.delete(wellnessLogs).where(and(eq(wellnessLogs.id, id), eq(wellnessLogs.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function getReminders(userId: number) {
  const db = await database();
  return db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.scheduleTime));
}

export async function createReminder(userId: number, values: {
  reminderType: "period" | "check_in" | "medication" | "appointment"; title: string; scheduleTime: string;
  scheduleFrequency: "once" | "daily" | "monthly"; isEnabled: boolean;
}) {
  const db = await database();
  const result = await db.insert(reminders).values({ userId, ...values, isEnabled: values.isEnabled ? 1 : 0, notificationPreview: "You have an Evara reminder." });
  return { id: result[0].insertId };
}

export async function updateReminder(userId: number, id: number, values: {
  reminderType: "period" | "check_in" | "medication" | "appointment"; title: string; scheduleTime: string;
  scheduleFrequency: "once" | "daily" | "monthly"; isEnabled: boolean;
}) {
  const db = await database();
  const result = await db.update(reminders).set({ ...values, isEnabled: values.isEnabled ? 1 : 0, notificationPreview: "You have an Evara reminder." })
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function deleteReminder(userId: number, id: number) {
  const db = await database();
  const result = await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return { success: result[0].affectedRows > 0 } as const;
}

export async function getCalendarRecords(userId: number, month: string) {
  const db = await database();
  const start = `${month}-01`;
  const end = `${month}-31`;
  const [periods, symptoms, wellness] = await Promise.all([
    db.select().from(periodLogs).where(and(eq(periodLogs.userId, userId), or(
      and(lte(periodLogs.startDate, end), gte(periodLogs.endDate, start)),
      and(lte(periodLogs.startDate, end), isNull(periodLogs.endDate)),
    ))),
    db.select().from(symptomLogs).where(and(eq(symptomLogs.userId, userId), gte(symptomLogs.logDate, start), lte(symptomLogs.logDate, end))),
    db.select().from(wellnessLogs).where(and(eq(wellnessLogs.userId, userId), gte(wellnessLogs.logDate, start), lte(wellnessLogs.logDate, end))),
  ]);
  return { periods, symptoms, wellness };
}

export async function clearHealthData(userId: number) {
  const db = await database();
  await Promise.all([
    db.delete(periodLogs).where(eq(periodLogs.userId, userId)),
    db.delete(symptomLogs).where(eq(symptomLogs.userId, userId)),
    db.delete(wellnessLogs).where(eq(wellnessLogs.userId, userId)),
    db.delete(reminders).where(eq(reminders.userId, userId)),
  ]);
}

export async function deleteUserAccount(userId: number) {
  const db = await database();
  const result = await db.delete(users).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}
