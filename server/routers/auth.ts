import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import {
  checkAuthRateLimit,
  createSession,
  hashPassword,
  recordAuthAttempt,
  resetAuthRateLimit,
  revokeSession,
  sanitizeUser,
  verifyPassword,
} from "../services/auth";
import { publicProcedure, router } from "../_core/trpc";

export const authRouter = router({
  /**
   * Retrieves the currently authenticated user, or null if unauthenticated.
   * Excludes sensitive fields such as passwordHash.
   */
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ? sanitizeUser(ctx.user) : null;
  }),

  /**
   * Registers a new local account with email and password.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please provide a valid email address.").max(320),
        password: z.string().min(8, "Password must be at least 8 characters long."),
        name: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = (ctx.req.ip || (ctx.req.headers["x-forwarded-for"] as string) || "127.0.0.1").split(",")[0].trim();
      checkAuthRateLimit(clientIp);

      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email address already exists. Please sign in or claim your legacy account.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = await db.createUser({
        email: input.email,
        passwordHash,
        name: input.name?.trim() || null,
        loginMethod: "local",
      });

      resetAuthRateLimit(clientIp);
      await createSession(user, ctx.req, ctx.res);

      return {
        user: sanitizeUser(user),
      };
    }),

  /**
   * Authenticates a user with email and password, establishing a secure session cookie.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please provide a valid email address."),
        password: z.string().min(1, "Password is required."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = (ctx.req.ip || (ctx.req.headers["x-forwarded-for"] as string) || "127.0.0.1").split(",")[0].trim();
      checkAuthRateLimit(clientIp);

      const user = await db.getUserByEmail(input.email);
      if (!user) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      // Check if user has a password set
      if (!user.passwordHash) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account was registered using legacy OAuth. Please set a password using the 'Claim Legacy Account' option.",
        });
      }

      const isMatch = await verifyPassword(input.password, user.passwordHash);
      if (!isMatch) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      resetAuthRateLimit(clientIp);
      await db.updateUserLastSignedIn(user.id);
      await createSession(user, ctx.req, ctx.res);

      return {
        user: sanitizeUser(user),
      };
    }),

  /**
   * Allows legacy accounts created via external OAuth to set a local password
   * and migrate smoothly to independent authentication without losing data.
   */
  claimLegacyAccount: publicProcedure
    .input(
      z
        .object({
          email: z.string().email("Please provide a valid email address."),
          newPassword: z.string().min(8, "New password must be at least 8 characters long."),
          verificationToken: z.string().min(1, "Verification token is required.").optional(),
          openId: z.string().min(1, "Legacy OpenID verification is required.").optional(),
        })
        .refine(data => Boolean(data.verificationToken || data.openId), {
          message: "A legacy verification token or OpenID is required to claim an existing account. Email-only claiming is prohibited.",
          path: ["verificationToken"],
        })
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = (ctx.req.ip || (ctx.req.headers["x-forwarded-for"] as string) || "127.0.0.1").split(",")[0].trim();
      checkAuthRateLimit(clientIp);

      const user = await db.getUserByEmail(input.email);
      if (!user) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No existing account found with this email address.",
        });
      }

      if (user.passwordHash) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account already has a local password configured. Please use standard sign in.",
        });
      }

      const providedToken = (input.verificationToken || input.openId || "").trim();
      if (!providedToken || !user.openId || providedToken !== user.openId) {
        recordAuthAttempt(clientIp);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid verification credentials. Email-only account claiming is strictly prohibited. Please provide your legitimate legacy verification token.",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await db.updateUserPassword(user.id, passwordHash);
      await db.updateUserLastSignedIn(user.id);

      resetAuthRateLimit(clientIp);
      await createSession(user, ctx.req, ctx.res);

      return {
        success: true,
        user: sanitizeUser(user),
      };
    }),

  /**
   * Logs out the user by revoking the session token and clearing the session cookie.
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieHeader = ctx.req.headers.cookie;
    let token: string | undefined;

    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map(c => c.trim())
        .find(c => c.startsWith(`${COOKIE_NAME}=`));
      if (match) {
        token = decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
      }
    }

    await revokeSession(token, ctx.req, ctx.res);
    return { success: true } as const;
  }),
});
