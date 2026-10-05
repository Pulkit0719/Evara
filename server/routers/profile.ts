import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, router } from "../_core/trpc";
import { clearHealthData, deleteUserAccount, getProfile, saveProfile } from "../db";
import { dateSchema } from "../lib/evara";
import { z } from "zod";
import { COOKIE_NAME } from "../../shared/const";

const profileInput = z.object({
  displayName: z.string().trim().min(2, "Enter the name you would like Evara to use.").max(80),
  typicalCycleLength: z.number().int().min(20).max(45),
  typicalPeriodDuration: z.number().int().min(2).max(10),
  lastPeriodStart: dateSchema.nullable(),
  trackingGoals: z.array(z.string().trim().min(1).max(48)).min(1, "Choose at least one tracking goal.").max(5),
});

export const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) => getProfile(ctx.user.id)),
  save: protectedProcedure.input(profileInput).mutation(({ ctx, input }) =>
    saveProfile(ctx.user.id, input),
  ),
  clearHealthData: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE") })).mutation(async ({ ctx }) => {
    await clearHealthData(ctx.user.id);
    return { success: true } as const;
  }),
  deleteAccount: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE") })).mutation(async ({ ctx }) => {
    const deleted = await deleteUserAccount(ctx.user.id);
    if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "This account is no longer available." });
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
