import { protectedProcedure, router } from "../_core/trpc";
import { getPeriodLogs, getProfile, getSymptomLogs, getWellnessLogs } from "../db";
import { average, calculateCycleSummary, daysBetween } from "../lib/evara";

export const insightsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [profile, periods, symptomLogs, wellnessLogs] = await Promise.all([
      getProfile(ctx.user.id),
      getPeriodLogs(ctx.user.id),
      getSymptomLogs(ctx.user.id),
      getWellnessLogs(ctx.user.id),
    ]);
    const cycle = calculateCycleSummary(periods, profile?.typicalCycleLength ?? null);
    const symptomCounts = symptomLogs.reduce<Record<string, number>>((counts, log) => {
      counts[log.symptom] = (counts[log.symptom] ?? 0) + 1;
      return counts;
    }, {});
    const symptomFrequency = Object.entries(symptomCounts)
      .map(([symptom, count]) => ({ symptom, count }))
      .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
    const timing = cycle.latestPeriodStart
      ? symptomLogs.map(log => ({
        symptom: log.symptom,
        logDate: log.logDate,
        daysFromLatestPeriod: daysBetween(cycle.latestPeriodStart!, log.logDate),
      }))
      : [];
    const wellnessTrend = wellnessLogs.slice(0, 7).reverse().map(log => ({
      logDate: log.logDate,
      mood: log.mood,
      sleepHours: log.sleepHours,
      pain: log.pain,
    }));
    return {
      cycle,
      symptomFrequency,
      symptomTiming: timing,
      wellnessTrend,
      recordedAverages: {
        mood: average(wellnessLogs.map(log => log.mood).filter((value): value is number => value !== null)),
        sleepHours: average(wellnessLogs.map(log => log.sleepHours).filter((value): value is number => value !== null)),
        pain: average(wellnessLogs.map(log => log.pain).filter((value): value is number => value !== null)),
      },
      dataPoints: {
        periods: periods.length,
        symptoms: symptomLogs.length,
        wellness: wellnessLogs.length,
      },
    };
  }),
});
