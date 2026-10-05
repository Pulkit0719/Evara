import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { calendarRouter } from "./routers/calendar";
import { insightsRouter } from "./routers/insights";
import { periodsRouter } from "./routers/periods";
import { profileRouter } from "./routers/profile";
import { remindersRouter } from "./routers/reminders";
import { reportsRouter } from "./routers/reports";
import { trackingRouter } from "./routers/tracking";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  profile: profileRouter,
  periods: periodsRouter,
  tracking: trackingRouter,
  calendar: calendarRouter,
  insights: insightsRouter,
  reminders: remindersRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
