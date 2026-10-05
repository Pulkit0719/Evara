import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { calendarRouter } from "./routers/calendar";
import { insightsRouter } from "./routers/insights";
import { periodsRouter } from "./routers/periods";
import { profileRouter } from "./routers/profile";
import { remindersRouter } from "./routers/reminders";
import { reportsRouter } from "./routers/reports";
import { trackingRouter } from "./routers/tracking";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  profile: profileRouter,
  periods: periodsRouter,
  tracking: trackingRouter,
  calendar: calendarRouter,
  insights: insightsRouter,
  reminders: remindersRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
