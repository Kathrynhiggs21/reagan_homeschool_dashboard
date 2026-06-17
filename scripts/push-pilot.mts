import { runCalendarSyncForRange } from "../server/_lib/googleCalendarSync";

/**
 * One-off: push the 2-week pilot (6/17–6/30) through the app's own sync
 * logic now that the calendar is writable. Idempotent (per-block upsert),
 * so re-running is safe.
 */
async function main() {
  const { totals, days } = await runCalendarSyncForRange("2026-06-17", "2026-06-30");
  console.log("PILOT PUSH RESULT");
  console.log(JSON.stringify({ totals }, null, 2));
  for (const d of days) {
    console.log(
      `  ${d.dateISO}: status=${d.status} created=${d.eventsCreated} updated=${d.eventsUpdated} deleted=${d.eventsDeleted} attendees=${d.attendeesInvited} errors=${d.errorCount}`,
    );
    if ((d as any).errors?.length) {
      for (const err of (d as any).errors) {
        console.log(`     ERROR: ${JSON.stringify(err)}`);
      }
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("PILOT PUSH FAILED:", e);
    process.exit(1);
  },
);
