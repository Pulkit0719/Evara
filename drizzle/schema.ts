import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core identity table for user accounts. Supports both local authentication and legacy accounts. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => ({
  emailIdx: index("users_email_idx").on(table.email),
}));

/** Server-controlled revocable sessions table. */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  userAgent: varchar("userAgent", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
}, table => ({
  userIdx: index("sessions_user_idx").on(table.userId),
  expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
}));

export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("displayName", { length: 80 }).notNull(),
  typicalCycleLength: int("typicalCycleLength").notNull(),
  typicalPeriodDuration: int("typicalPeriodDuration").notNull(),
  lastPeriodStart: varchar("lastPeriodStart", { length: 10 }),
  trackingGoals: json("trackingGoals").$type<string[]>().notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userUnique: uniqueIndex("userProfiles_userId_unique").on(table.userId),
}));

export const periodLogs = mysqlTable("periodLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }),
  flowIntensity: mysqlEnum("flowIntensity", ["light", "medium", "heavy"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerStartIdx: index("periodLogs_owner_start_idx").on(table.userId, table.startDate),
  ownerStartUnique: uniqueIndex("periodLogs_owner_start_unique").on(table.userId, table.startDate),
}));

export const symptomLogs = mysqlTable("symptomLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  logDate: varchar("logDate", { length: 10 }).notNull(),
  symptom: varchar("symptom", { length: 40 }).notNull(),
  severity: mysqlEnum("severity", ["mild", "moderate", "severe"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerDateIdx: index("symptomLogs_owner_date_idx").on(table.userId, table.logDate),
}));

export const wellnessLogs = mysqlTable("wellnessLogs", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userDayUnique: uniqueIndex("wellnessLogs_user_date_unique").on(table.userId, table.logDate),
}));

export const reminders = mysqlTable("reminders", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIdx: index("reminders_owner_idx").on(table.userId),
  taskUnique: uniqueIndex("reminders_task_uid_unique").on(table.scheduleCronTaskUid),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type PeriodLog = typeof periodLogs.$inferSelect;
export type SymptomLog = typeof symptomLogs.$inferSelect;
export type WellnessLog = typeof wellnessLogs.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
