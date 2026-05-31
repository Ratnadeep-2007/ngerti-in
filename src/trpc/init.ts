import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { auth, getSessionCore } from "@/lib/auth";
import { headers } from "next/headers";
import { ZodError } from "zod";

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const h = await headers();
  const session = await getSessionCore(h);

  if (!session) {
    console.log("❌ [TRPC Context] No session found");
  } else {
    console.log("✅ [TRPC Context] Session found for user:", session.user.id);
  }

  return {
    session,
    headers: h,
  };
});
export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<TRPCContext>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = baseProcedure.use(async ({ ctx, next, path }) => {
  if (!ctx.session) {
    console.warn(`🔐 [TRPC] Unauthorized attempt to path: ${path} - No session found`);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.session,
    },
  });
});
