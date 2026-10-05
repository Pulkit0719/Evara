import { describe, expect, it } from "vitest";
import { calculateCycleSummary, dateSchema, daysBetween, phaseForDate, severitySchema, symptomSchema } from "./evara";

describe("Evara cycle calculations", () => {
  it("calculates averages and labels the next period as a derived estimate", () => {
    const summary = calculateCycleSummary([
      { startDate: "2026-01-01", endDate: "2026-01-05" },
      { startDate: "2026-01-29", endDate: "2026-02-02" },
      { startDate: "2026-02-26", endDate: "2026-03-02" },
    ], null);

    expect(summary.averageCycleLength).toBe(28);
    expect(summary.averagePeriodDuration).toBe(5);
    expect(summary.cycleVariation).toBe(0);
    expect(summary.estimatedNextPeriod).toBe("2026-03-26");
  });

  it("uses a configured typical length only when there is not enough recorded history", () => {
    const summary = calculateCycleSummary([{ startDate: "2026-04-10", endDate: null }], 30);
    expect(summary.averageCycleLength).toBe(30);
    expect(summary.estimatedNextPeriod).toBe("2026-05-10");
    expect(summary.averagePeriodDuration).toBeNull();
  });

  it("handles calendar boundaries without local timezone drift", () => {
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(phaseForDate("2026-03-01", "2026-02-26", 28)).toBe("Period");
  });
});

describe("Evara symptom constraints", () => {
  it("permits only the three defined severity levels", () => {
    expect(severitySchema.safeParse("mild").success).toBe(true);
    expect(severitySchema.safeParse("moderate").success).toBe(true);
    expect(severitySchema.safeParse("severe").success).toBe(true);
    expect(severitySchema.safeParse("extreme").success).toBe(false);
  });

  it("includes the required predefined symptoms", () => {
    ["cramps", "bloating", "headache", "fatigue", "mood changes"].forEach(symptom => {
      expect(symptomSchema.safeParse(symptom).success).toBe(true);
    });
  });
});

describe("Evara calendar date validation", () => {
  it("accepts real UTC calendar dates and rejects impossible values", () => {
    expect(dateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2026-13-01").success).toBe(false);
    expect(dateSchema.safeParse("2026-04-31").success).toBe(false);
  });
});
