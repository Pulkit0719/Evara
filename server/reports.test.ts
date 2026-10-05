import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { getPeriodLogs: vi.fn(), getProfile: vi.fn(), getReminders: vi.fn(), getSymptomLogs: vi.fn(), getWellnessLogs: vi.fn() };
vi.mock("./db", () => db);
const { reportsRouter } = await import("./routers/reports");
const context = { user: { id: 73 } } as never;

describe("Evara private health reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getProfile.mockResolvedValue({ id: 1, userId: 73, displayName: "Avery", typicalCycleLength: 29, typicalPeriodDuration: 5, lastPeriodStart: null, trackingGoals: ["Understand my cycle"], completedAt: new Date(), updatedAt: new Date() });
    db.getPeriodLogs.mockResolvedValue([{ id: 2, userId: 73, startDate: "2026-07-01", endDate: "2026-07-05", flowIntensity: "medium", notes: null, createdAt: new Date(), updatedAt: new Date() }, { id: 3, userId: 73, startDate: "2026-07-30", endDate: "2026-08-03", flowIntensity: "light", notes: null, createdAt: new Date(), updatedAt: new Date() }]);
    db.getSymptomLogs.mockResolvedValue([{ id: 4, userId: 73, logDate: "2026-08-01", symptom: "cramps", severity: "moderate", notes: null, createdAt: new Date(), updatedAt: new Date() }]);
    db.getWellnessLogs.mockResolvedValue([{ id: 5, userId: 73, logDate: "2026-08-02", mood: 4, energy: 3, sleepHours: 7, waterGlasses: 6, activityMinutes: 30, stress: 2, pain: 3, notes: null, createdAt: new Date(), updatedAt: new Date() }]);
    db.getReminders.mockResolvedValue([]);
  });

  it("builds a summary from only the authenticated user’s helper calls", async () => {
    const summary = await reportsRouter.createCaller(context).summary();
    [db.getProfile, db.getPeriodLogs, db.getSymptomLogs, db.getWellnessLogs, db.getReminders].forEach(helper => expect(helper).toHaveBeenCalledWith(73));
    expect(summary.profile).toEqual({ displayName: "Avery" });
    expect(summary.cycle.averageCycleLength).toBe(29);
    expect(summary.symptomFrequency).toEqual([{ symptom: "cramps", count: 1 }]);
    expect(summary.recentPeriods[0]).not.toHaveProperty("userId");
  });

  it("exports private records without internal owner identifiers or scheduler metadata", async () => {
    const exported = await reportsRouter.createCaller(context).exportData();
    expect(exported.data.profile).not.toHaveProperty("userId");
    expect(exported.data.periods[0]).not.toHaveProperty("userId");
    expect(exported.data.symptoms[0]).not.toHaveProperty("userId");
    expect(exported.data.wellness[0]).not.toHaveProperty("userId");
  });
});

