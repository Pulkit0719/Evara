import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  createPeriodLog: vi.fn(), deletePeriodLog: vi.fn(), getPeriodLogs: vi.fn(), getProfile: vi.fn(), periodStartExists: vi.fn(), updatePeriodLog: vi.fn(),
  createSymptomLog: vi.fn(), deleteSymptomLog: vi.fn(), deleteWellnessLog: vi.fn(), getSymptomLogs: vi.fn(), getWellnessLogs: vi.fn(), saveWellnessLog: vi.fn(), updateSymptomLog: vi.fn(),
  createReminder: vi.fn(), deleteReminder: vi.fn(), getReminders: vi.fn(), updateReminder: vi.fn(),
};

vi.mock("./db", () => db);

const { periodsRouter } = await import("./routers/periods");
const { trackingRouter } = await import("./routers/tracking");
const { remindersRouter } = await import("./routers/reminders");

const context = { user: { id: 42 } } as never;
const periodInput = { startDate: "2026-04-01", endDate: "2026-04-05", flowIntensity: "medium" as const, notes: null };

describe("Evara private-record mutation boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); db.periodStartExists.mockResolvedValue(false); });

  it("does not report success when a period update is not owned by the caller", async () => {
    db.updatePeriodLog.mockResolvedValue({ success: false });
    await expect(periodsRouter.createCaller(context).update({ id: 91, ...periodInput })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updatePeriodLog).toHaveBeenCalledWith(42, 91, periodInput);
  });

  it("does not report success when a symptom delete is not owned by the caller", async () => {
    db.deleteSymptomLog.mockResolvedValue({ success: false });
    await expect(trackingRouter.createCaller(context).symptoms.delete({ id: 92 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.deleteSymptomLog).toHaveBeenCalledWith(42, 92);
  });

  it("does not report success when a wellness delete is not owned by the caller", async () => {
    db.deleteWellnessLog.mockResolvedValue({ success: false });
    await expect(trackingRouter.createCaller(context).wellness.delete({ id: 93 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.deleteWellnessLog).toHaveBeenCalledWith(42, 93);
  });

  it("does not report success when a reminder update is not owned by the caller", async () => {
    db.updateReminder.mockResolvedValue({ success: false });
    await expect(remindersRouter.createCaller(context).update({ id: 94, reminderType: "check_in", title: "Evening check-in", scheduleTime: "19:00", scheduleFrequency: "daily", isEnabled: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updateReminder).toHaveBeenCalledWith(42, 94, { reminderType: "check_in", title: "Evening check-in", scheduleTime: "19:00", scheduleFrequency: "daily", isEnabled: true });
  });
});

