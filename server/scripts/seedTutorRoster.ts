/**
 * Slice 4 push 13 — Item M: seed the recurring tutor roster.
 *
 * Saves into the database what Marcy described in the todo:
 *   Week A
 *     Mon 10–15  Madison
 *     Tue 10–15  Sophie
 *     Wed 10–15  Madison
 *     Thu 11–14  Keith
 *     Fri 10–15  Sophie
 *   Week B
 *     Mon 10–15  Sophie
 *     Tue 10–15  Sophie
 *     Wed 10–15  Sophie
 *     Thu 11–14  Keith
 *     Fri 10–15  Sophie
 *
 * Also logs the 4 May 2026 Madison-sick (excused) absence by inserting a
 * `cancelled` session for that day with explanatory focus text, so the
 * historical record is honest.
 *
 * Anchor: the ISO-week of 2026-05-04 (Mon) is "Week A". From there we walk
 * 12 weeks forward, alternating A/B/A/B…
 *
 * Idempotent. A session is skipped if a row already exists for the same
 * tutorId + scheduledAt to within one minute.
 *
 * Run with:
 *   cd /home/ubuntu/reagan_homeschool_dashboard
 *   pnpm tsx server/scripts/seedTutorRoster.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

type SlotName = "Madison" | "Sophie" | "Keith";

const ANCHOR_MONDAY = "2026-05-04"; // start of Week A
const WEEKS = 12;

// 0=Sun, 1=Mon, ... 5=Fri. Each entry: tutor name, arrival H, departure H.
type DaySlot = { tutor: SlotName; startHour: number; endHour: number; focus: string };
const WEEK_A: Record<number, DaySlot> = {
  1: { tutor: "Madison", startHour: 10, endHour: 15, focus: "Week A · Monday tutor session" },
  2: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week A · Tuesday tutor session" },
  3: { tutor: "Madison", startHour: 10, endHour: 15, focus: "Week A · Wednesday tutor session" },
  4: { tutor: "Keith",   startHour: 11, endHour: 14, focus: "Week A · Thursday tutor session" },
  5: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week A · Friday tutor session" },
};
const WEEK_B: Record<number, DaySlot> = {
  1: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week B · Monday tutor session" },
  2: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week B · Tuesday tutor session" },
  3: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week B · Wednesday tutor session" },
  4: { tutor: "Keith",   startHour: 11, endHour: 14, focus: "Week B · Thursday tutor session" },
  5: { tutor: "Sophie",  startHour: 10, endHour: 15, focus: "Week B · Friday tutor session" },
};

const TUTOR_DEFAULTS: Record<SlotName, { role: string; subjects: string }> = {
  Madison: { role: "tutor", subjects: "Math, ELA" },
  Sophie:  { role: "tutor", subjects: "Math, ELA, Specials" },
  Keith:   { role: "tutor", subjects: "Science, ELA" },
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function localTimestamp(dateStr: string, hour: number): Date {
  // Local timezone — matches what tutorOfDay.ts reads back via BETWEEN on local
  // strings. We anchor at the chosen hour.
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);
}

async function ensureTutorByName(db: any, name: SlotName): Promise<number> {
  const existing: any[] = ((await db.execute(
    sql`SELECT id FROM tutors WHERE name = ${name} LIMIT 1`,
  )) as any)[0] ?? [];
  if (existing[0]?.id) return Number(existing[0].id);
  const def = TUTOR_DEFAULTS[name];
  const ins: any = await db.execute(sql`
    INSERT INTO tutors (name, role, subjects, active) VALUES
    (${name}, ${def.role}, ${def.subjects}, TRUE)
  `);
  // Different drivers expose insertId differently; query back by name to be safe.
  const after: any[] = ((await db.execute(
    sql`SELECT id FROM tutors WHERE name = ${name} LIMIT 1`,
  )) as any)[0] ?? [];
  if (after[0]?.id) return Number(after[0].id);
  // Fallback to driver-reported insertId if the SELECT raced.
  const fallback = ins?.insertId ?? ins?.[0]?.insertId ?? null;
  if (fallback) return Number(fallback);
  throw new Error(`Failed to ensure tutor "${name}"`);
}

async function existsSession(db: any, tutorId: number, ts: Date): Promise<boolean> {
  const startMin = new Date(ts.getTime() - 60_000);
  const endMin = new Date(ts.getTime() + 60_000);
  const rows: any[] = ((await db.execute(sql`
    SELECT id FROM tutorSessions
    WHERE tutorId = ${tutorId}
      AND scheduledAt BETWEEN ${startMin.toISOString().replace("T", " ").slice(0, 19)}
                          AND ${endMin.toISOString().replace("T", " ").slice(0, 19)}
    LIMIT 1
  `)) as any)[0] ?? [];
  return rows.length > 0;
}

async function insertSession(
  db: any,
  tutorId: number,
  ts: Date,
  durationMin: number,
  focus: string,
  status: "scheduled" | "cancelled" = "scheduled",
) {
  const tsStr = ts.toISOString().replace("T", " ").slice(0, 19);
  await db.execute(sql`
    INSERT INTO tutorSessions (tutorId, scheduledAt, durationMin, focus, status)
    VALUES (${tutorId}, ${tsStr}, ${durationMin}, ${focus}, ${status})
  `);
}

async function main() {
  const db = getDb();
  console.log("Ensuring tutors exist…");
  const tutorIds: Record<SlotName, number> = {
    Madison: await ensureTutorByName(db, "Madison"),
    Sophie:  await ensureTutorByName(db, "Sophie"),
    Keith:   await ensureTutorByName(db, "Keith"),
  };
  console.log("Tutor IDs:", tutorIds);

  const anchor = new Date(`${ANCHOR_MONDAY}T00:00:00`);
  let created = 0;
  let skipped = 0;
  for (let w = 0; w < WEEKS; w++) {
    const isWeekA = (w % 2) === 0;
    const week = isWeekA ? WEEK_A : WEEK_B;
    for (let d = 1; d <= 5; d++) {
      const slot = week[d];
      if (!slot) continue;
      const day = addDays(anchor, w * 7 + (d - 1));
      const dateStr = ymd(day);
      const start = localTimestamp(dateStr, slot.startHour);
      const tutorId = tutorIds[slot.tutor];
      if (await existsSession(db, tutorId, start)) {
        skipped++;
        continue;
      }
      await insertSession(
        db,
        tutorId,
        start,
        (slot.endHour - slot.startHour) * 60,
        slot.focus,
        "scheduled",
      );
      created++;
    }
  }
  console.log(`Recurring sessions: created=${created}, skipped (already existed)=${skipped}`);

  // Log Madison's 2026-05-04 absence by inserting an explicit cancelled row
  // alongside the (now-seeded) scheduled row, so the historical record reads
  // "scheduled but absent (sick — excused)". If the cancellation row already
  // exists we skip.
  const absenceDate = "2026-05-04";
  const absenceTs = localTimestamp(absenceDate, 10);
  // Use 10:01 to disambiguate from the 10:00 scheduled row.
  const absenceMarker = new Date(absenceTs.getTime() + 60_000);
  const madisonId = tutorIds.Madison;
  if (!(await existsSession(db, madisonId, absenceMarker))) {
    await insertSession(
      db,
      madisonId,
      absenceMarker,
      1, // 1 minute marker — purely a record-keeping row
      "ABSENT — Madison out sick on 2026-05-04 (excused). Logged 2026-05-12.",
      "cancelled",
    );
    console.log("Inserted Madison absence marker for 2026-05-04.");
  } else {
    console.log("Madison absence marker for 2026-05-04 already present, skipped.");
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
