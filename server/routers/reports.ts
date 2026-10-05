import { protectedProcedure, router } from "../_core/trpc";
import { getPeriodLogs, getProfile, getReminders, getSymptomLogs, getWellnessLogs } from "../db";
import { average, calculateCycleSummary } from "../lib/evara";

function threeMonthsAgo() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 3);
  return date.toISOString().slice(0, 10);
}

async function getOwnedHealthData(userId: number) {
  const [profile, periods, symptoms, wellness, reminderPreferences] = await Promise.all([
    getProfile(userId), getPeriodLogs(userId), getSymptomLogs(userId), getWellnessLogs(userId), getReminders(userId),
  ]);
  return { profile, periods, symptoms, wellness, reminderPreferences };
}

function withoutOwnerId<T extends { userId: number }>(record: T) {
  const { userId: _userId, ...safeRecord } = record;
  return safeRecord;
}

function exportableData(data: Awaited<ReturnType<typeof getOwnedHealthData>>) {
  const profile = data.profile ? withoutOwnerId(data.profile) : null;
  const reminderPreferences = data.reminderPreferences.map(reminder => {
    const { userId: _userId, scheduleCronTaskUid: _taskUid, ...safeReminder } = reminder;
    return safeReminder;
  });
  return {
    profile,
    periods: data.periods.map(withoutOwnerId),
    symptoms: data.symptoms.map(withoutOwnerId),
    wellness: data.wellness.map(withoutOwnerId),
    reminderPreferences,
  };
}

export const reportsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const data = await getOwnedHealthData(ctx.user.id);
    const rangeStart = threeMonthsAgo();
    const periods = data.periods.filter(log => log.startDate >= rangeStart || (log.endDate && log.endDate >= rangeStart));
    const symptoms = data.symptoms.filter(log => log.logDate >= rangeStart);
    const wellness = data.wellness.filter(log => log.logDate >= rangeStart);
    const symptomFrequency = Object.entries(symptoms.reduce<Record<string, number>>((counts, log) => {
      counts[log.symptom] = (counts[log.symptom] ?? 0) + 1;
      return counts;
    }, {})).map(([symptom, count]) => ({ symptom, count })).sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
    const cycle = calculateCycleSummary(periods, data.profile?.typicalCycleLength ?? null);
    return {
      generatedAt: new Date().toISOString(),
      rangeStart,
      profile: data.profile ? { displayName: data.profile.displayName } : null,
      cycle: { ...cycle, recentCycleLengths: cycle.cycleLengths.slice(-3) },
      symptomFrequency,
      wellnessAverages: {
        mood: average(wellness.map(log => log.mood).filter((value): value is number => value !== null)),
        pain: average(wellness.map(log => log.pain).filter((value): value is number => value !== null)),
        sleepHours: average(wellness.map(log => log.sleepHours).filter((value): value is number => value !== null)),
      },
      recentPeriods: periods.slice(0, 6).map(withoutOwnerId),
      recordCounts: { periods: periods.length, symptoms: symptoms.length, wellness: wellness.length },
    };
  }),
  exportData: protectedProcedure.mutation(async ({ ctx }) => ({ schemaVersion: 1, exportedAt: new Date().toISOString(), data: exportableData(await getOwnedHealthData(ctx.user.id)) })),
});
