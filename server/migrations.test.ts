import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Database Migration Journal & Schema Reconciliation", () => {
  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  const metaDir = path.join(drizzleDir, "meta");
  const journalPath = path.join(metaDir, "_journal.json");

  it("has a valid Drizzle migration journal file", () => {
    expect(fs.existsSync(journalPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    expect(content.dialect).toBe("mysql");
    expect(Array.isArray(content.entries)).toBe(true);
    expect(content.entries.length).toBeGreaterThanOrEqual(4);
  });

  it("registers 0003_add_local_auth_and_sessions in the migration journal", () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry3 = journal.entries.find((e: any) => e.idx === 3);

    expect(entry3).toBeDefined();
    expect(entry3.tag).toBe("0003_add_local_auth_and_sessions");
    expect(entry3.breakpoints).toBe(true);
  });

  it("has a matching SQL file for every registered journal entry", () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

    for (const entry of journal.entries) {
      const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
      expect(fs.existsSync(sqlFile), `Migration file ${entry.tag}.sql must exist`).toBe(true);
    }
  });

  it("verifies 0003 migration includes passwordHash and sessions table with statement breakpoints", () => {
    const migrationFile = path.join(drizzleDir, "0003_add_local_auth_and_sessions.sql");
    const content = fs.readFileSync(migrationFile, "utf-8");

    expect(content).toContain("CREATE TABLE `sessions`");
    expect(content).toContain("`passwordHash`");
    expect(content).toContain("`users_email_idx`");
    expect(content).toContain("--> statement-breakpoint");
  });
});
