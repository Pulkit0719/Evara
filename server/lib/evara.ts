import { z } from "zod";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const dateSchema = z.string().regex(DATE_PATTERN, "Use a valid calendar date.").refine(value => {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date.");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");

export const symptoms = [
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
  "sleep issues",
] as const;

export const symptomSchema = z.enum(symptoms);
export const severitySchema = z.enum(["mild", "moderate", "severe"]);
export const flowSchema = z.enum(["light", "medium", "heavy"]);
export const reminderTypeSchema = z.enum(["period", "check_in", "medication", "appointment"]);
export const reminderFrequencySchema = z.enum(["once", "daily", "monthly"]);

export type PeriodForCalculation = { startDate: string; endDate: string | null };

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function parseDay(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function toDayString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function daysBetween(startDate: string, endDate: string): number {
  return Math.round((parseDay(endDate).getTime() - parseDay(startDate).getTime()) / millisecondsPerDay);
}

export function addDays(date: string, days: number): string {
  const result = parseDay(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toDayString(result);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function calculateCycleSummary(periods: PeriodForCalculation[], fallbackCycleLength: number | null) {
  const chronological = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cycleLengths = chronological.slice(1).map((period, index) =>
    daysBetween(chronological[index].startDate, period.startDate),
  ).filter(length => length > 0 && length <= 90);
  const periodDurations = chronological
    .filter(period => period.endDate)
    .map(period => daysBetween(period.startDate, period.endDate!) + 1)
    .filter(length => length > 0 && length <= 21);
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
    estimatedNextPeriod: latestPeriod && averageCycleLength
      ? addDays(latestPeriod.startDate, Math.round(averageCycleLength))
      : null,
  };
}

export function phaseForDate(day: string, latestPeriodStart: string | null, cycleLength: number | null): string | null {
  if (!latestPeriodStart || !cycleLength) return null;
  const dayOffset = daysBetween(latestPeriodStart, day);
  if (dayOffset < 0) return null;
  const cycleDay = dayOffset % Math.round(cycleLength);
  if (cycleDay <= 5) return "Period";
  if (cycleDay <= Math.round(cycleLength * 0.45)) return "Follicular";
  if (cycleDay <= Math.round(cycleLength * 0.58)) return "Ovulation window";
  return "Luteal";
}
