import { auth } from "@/lib/auth";
import { initTRPC, TRPCError } from '@trpc/server';
import { headers } from "next/headers";
import { cache } from 'react';
export const createTRPCContext = cache(async () => {
    /**
     * @see: https://trpc.io/docs/server/context
     */
    return {};
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
    /**
     * @see https://trpc.io/docs/server/data-transformers
     */
    // transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
    // In caller tests or custom context, respect explicit auth session; otherwise query Better Auth via request headers
    const ctxAuth = "auth" in ctx ? (ctx as { auth?: typeof auth.$Infer.Session | null }).auth : undefined;
    let session = ctxAuth;
    if (session === undefined) {
        session = await auth.api.getSession({
            headers: await headers(),
        });
    }

    if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }

    return next({ ctx: { ...ctx, auth: session } });
});