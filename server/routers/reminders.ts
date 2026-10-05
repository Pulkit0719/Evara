import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createReminder, deleteReminder, getReminders, updateReminder } from "../db";
import { reminderFrequencySchema, reminderTypeSchema, timeSchema } from "../lib/evara";

const reminderInput = z.object({
  reminderType: reminderTypeSchema,
  title: z.string().trim().min(2, "Give this reminder a short name.").max(80),
  scheduleTime: timeSchema,
  scheduleFrequency: reminderFrequencySchema,
  isEnabled: z.boolean(),
});

export const remindersRouter = router({
  list: protectedProcedure.query(({ ctx }) => getReminders(ctx.user.id)),
  create: protectedProcedure.input(reminderInput).mutation(({ ctx, input }) => createReminder(ctx.user.id, input)),
  update: protectedProcedure.input(reminderInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    const result = await updateReminder(ctx.user.id, id, values);
    if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This reminder preference is no longer available." });
    return result;
  }),
  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const result = await deleteReminder(ctx.user.id, input.id);
    if (!result.success) throw new TRPCError({ code: "NOT_FOUND", message: "This reminder preference is no longer available." });
    return result;
  }),
});
