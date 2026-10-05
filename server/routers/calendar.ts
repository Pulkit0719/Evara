import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getCalendarRecords, getPeriodLogs, getProfile } from "../db";
import { addDays, calculateCycleSummary, phaseForDate } from "../lib/evara";

export const calendarRouter = router({
  month: protectedProcedure.input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const [records, periods, profile] = await Promise.all([
      getCalendarRecords(ctx.user.id, input.month),
      getPeriodLogs(ctx.user.id),
      getProfile(ctx.user.id),
    ]);
    const cycle = calculateCycleSummary(periods, profile?.typicalCycleLength ?? null);
    const phaseByDay: Record<string, string | null> = {};
    for (let day = 1; day <= 31; day += 1) {
      const dayString = `${input.month}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${dayString}T12:00:00.000Z`);
      if (parsed.getUTCMonth() + 1 !== Number(input.month.slice(5))) continue;
      phaseByDay[dayString] = phaseForDate(dayString, cycle.latestPeriodStart, cycle.averageCycleLength);
    }
    const estimatedPeriodDays = cycle.estimatedNextPeriod
      ? Array.from(
        { length: Math.max(1, Math.round(cycle.averagePeriodDuration ?? profile?.typicalPeriodDuration ?? 1)) },
        (_, index) => addDays(cycle.estimatedNextPeriod!, index),
      )
      : [];
    return { ...records, estimatedNextPeriod: cycle.estimatedNextPeriod, estimatedPeriodDays, phaseByDay };
  }),
});
