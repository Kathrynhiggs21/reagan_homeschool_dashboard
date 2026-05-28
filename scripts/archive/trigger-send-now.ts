/**
 * scripts/trigger-send-now.ts
 *
 * One-shot helper: invokes nightlyAgenda.sendNow with an admin-equivalent
 * tRPC context so Mom gets the agenda right now without waiting on the
 * (currently broken) 7 AM cron. Run with:
 *
 *   pnpm tsx scripts/trigger-send-now.ts
 *
 * Optional first arg = forDate (YYYY-MM-DD); defaults to today (ET).
 */
import { appRouter } from "../server/routers";

async function main() {
  const arg = process.argv[2];
  const forDate = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : undefined;

  // Mom-equivalent context. familyAdminProcedure keys on email +
  // role==='user'|'admin'. spear.cpt@gmail.com always passes the gate.
  const ctx = {
    user: {
      id: 1,
      openId: process.env.OWNER_OPEN_ID || "trigger-script",
      role: "user" as const,
      name: "Mom (trigger script)",
      email: "spear.cpt@gmail.com",
    },
  };

  const caller = appRouter.createCaller(ctx as any);
  const res = await caller.nightlyAgenda.sendNow(
    forDate ? { forDate } : undefined,
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
