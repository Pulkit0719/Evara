import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createPeriodLog, deletePeriodLog, getPeriodLogs, getProfile, periodStartExists, updatePeriodLog } from "../db";
import { calculateCycleSummary, dateSchema, flowSchema } from "../lib/evara";

const periodInput = z.object({
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  flowIntensity: flowSchema,
  notes: z.string().trim().max(500).nullable(),
}).refine(input => !input.endDate || input.endDate >= input.startDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});

export const periodsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getPeriodLogs(ctx.user.id)),
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [logs, profile] = await Promise.all([getPeriodLogs(ctx.user.id), getProfile(ctx.user.id)]);
    return calculateCycleSummary(logs, profile?.typicalCycleLength ?? null);
  }),
  create: protectedProcedure.input(periodInput).mutation(async ({ ctx, input }) => {
    if (await periodStartExists(ctx.user.id, input.startDate)) {
      throw new TRPCError({ code: "CONFLICT", message: "You already have a period entry starting on this date." });
    }
    return createPeriodLog(ctx.user.id, input);
  }),
  update: protectedProcedure.input(periodInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    if (await periodStartExists(ctx.user.id, values.startDate, id)) {
      throw new TRPCError({ code: "CONFLICT", message: "You already have a period entry starting on this date." });
    }
    const result = await updatePeriodLog(ctx.user.id, id, values);
    if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This period record is no longer available." });
    return result;
  }),
  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const result = await deletePeriodLog(ctx.user.id, input.id);
    if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This period record is no longer available." });
    return result;
  }),
});
