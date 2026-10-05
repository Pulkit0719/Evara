import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createSymptomLog, deleteSymptomLog, deleteWellnessLog, getSymptomLogs, getWellnessLogs, saveWellnessLog, updateSymptomLog } from "../db";
import { dateSchema, severitySchema, symptomSchema } from "../lib/evara";

const symptomInput = z.object({
  logDate: dateSchema,
  symptom: symptomSchema,
  severity: severitySchema,
  notes: z.string().trim().max(500).nullable(),
});

const wellbeingScore = z.number().int().min(1).max(5).nullable();
const wellnessInput = z.object({
  logDate: dateSchema,
  mood: wellbeingScore,
  energy: wellbeingScore,
  sleepHours: z.number().int().min(0).max(18).nullable(),
  waterGlasses: z.number().int().min(0).max(30).nullable(),
  activityMinutes: z.number().int().min(0).max(1440).nullable(),
  stress: wellbeingScore,
  pain: wellbeingScore,
  notes: z.string().trim().max(750).nullable(),
}).refine(input => Object.entries(input).some(([key, value]) => key !== "logDate" && value !== null), {
  message: "Add at least one check-in detail before saving.",
});

export const trackingRouter = router({
  symptoms: router({
    list: protectedProcedure.query(({ ctx }) => getSymptomLogs(ctx.user.id)),
    create: protectedProcedure.input(symptomInput).mutation(({ ctx, input }) => createSymptomLog(ctx.user.id, input)),
    update: protectedProcedure.input(symptomInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const result = await updateSymptomLog(ctx.user.id, id, values);
      if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This symptom record is no longer available." });
      return result;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await deleteSymptomLog(ctx.user.id, input.id);
      if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This symptom record is no longer available." });
      return result;
    }),
  }),
  wellness: router({
    list: protectedProcedure.query(({ ctx }) => getWellnessLogs(ctx.user.id)),
    save: protectedProcedure.input(wellnessInput).mutation(({ ctx, input }) => saveWellnessLog(ctx.user.id, input)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await deleteWellnessLog(ctx.user.id, input.id);
      if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This daily check-in is no longer available." });
      return result;
    }),
  }),
});
