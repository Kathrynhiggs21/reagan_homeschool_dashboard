/**
 * One-shot script: run blockAutoAttach.runAutoAttachForDate for 2026-05-28
 * so tomorrow's plan has resources attached before any human opens it.
 *
 * Created v2.93 (2026-05-27). Idempotent — safe to re-run; will skip any
 * block that already has resources.
 */
import { runAutoAttachForDate } from "../server/_lib/blockAutoAttach";

(async () => {
  console.log("[fire] running auto-attach for 2026-05-28");
  const result = await runAutoAttachForDate("2026-05-28", { kidSafe: true });
  console.log(
    JSON.stringify(
      {
        date: result.date,
        totalBlocks: result.totalBlocks,
        attached: result.attached,
        skipped: result.skipped,
        noResult: result.noResult,
        errors: result.errors,
        reports: result.reports.map((r) => ({
          id: r.blockId,
          action: r.action,
          title: r.attachedTitle,
          type: r.attachedType,
          err: r.errorMessage,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
