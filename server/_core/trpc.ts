import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { roleForEmail } from "../_lib/permissions";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Phase B-α.5 — tutor + admin gate. Used by surfaces that BOTH parents and
// tutors should be able to use (agenda editor, per-block edits, uploads,
// design-from-blank, notebook attachments, candidate picker, teleconference).
// Reagan (role: "user") is still excluded. Anything tutor-write-able should
// still leave admin-only destructive ops (delete day, edit roster) on
// adminProcedure.
//
// May 11 2026 update — Mom (parent) + Grandma Marcy (editor) ALWAYS pass this
// gate regardless of their DB role, because they must be able to edit any
// day's agenda with no exceptions (per Mom's directive). The check now
// consults permissions.roleForEmail() as a second pass.
export const adminOrTutorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const dbRoleOk = ctx.user.role === 'admin' || ctx.user.role === 'tutor';
    const familyRole = roleForEmail((ctx.user as any).email ?? null);
    const familyOk = familyRole === 'parent' || familyRole === 'editor' || familyRole === 'tutor';
    if (!dbRoleOk && !familyOk) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

// May 11 2026 — Family-admin gate. Mom + Grandma ALWAYS pass, no date check,
// no approval, no exceptions. DB-admin and DB-tutor sessions also pass. Use
// this on every agenda-edit procedure that should be unconditionally
// available to the home team.
export const familyAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const familyRole = roleForEmail((ctx.user as any).email ?? null);
    const familyOk = familyRole === 'parent' || familyRole === 'editor' || familyRole === 'tutor';
    const dbRoleOk = ctx.user.role === 'admin' || ctx.user.role === 'tutor';
    if (!dbRoleOk && !familyOk) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
