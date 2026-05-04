/**
 * tutorOfDay — given a YYYY-MM-DD, return the human(s) Reagan will work with
 * that day. Pulls from two sources, in priority order:
 *
 *   1. Concrete `tutorSessions` rows scheduled for that calendar date.
 *   2. Recurring `appointments` rows whose `recurrenceRule` resolves to the
 *      same weekday (so Wednesday therapy with Ali Hill, LISW, surfaces every
 *      Wednesday without anyone hand-creating a session row).
 *
 * If nothing is scheduled, returns null and the caller treats the day as
 * Mom-only. The resolver is intentionally read-only — it never writes back to
 * either table.
 *
 * Used by:
 *   - server/_lib/aiScheduleGenerator.ts → drops the tutor window into the
 *     LLM prompt so academic blocks land inside that window.
 *   - server/routers.ts (curriculum.aiGenerate / syncFutureDays / aiCommit)
 *     so the resulting agenda row gets stamped with the tutor name + arrival
 *     + departure for the printable PDF + email.
 *   - the nightly agenda PDF generator.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export type TutorOfDay = {
  /** Display name, e.g. "Marcy Spear" or "Ali Hill, LISW". */
  name: string;
  /** "Tutor", "Therapist", "Parent helper" etc. — surfaced in the email body. */
  role: string | null;
  /** "09:00" 24h. Departure for off-site appointments, or first session start. */
  arrival: string;
  /** "12:00" 24h. */
  departure: string;
  /** "tutor_session" | "appointment" — for the audit log. */
  source: "tutor_session" | "appointment";
  /** Foreign key back to the source row, useful for the tutor co-pilot panel. */
  sourceId: number;
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function parseRecurrence(rule: string | null | undefined): { weekly?: number } {
  if (!rule) return {};
  const m = /^weekly:(\w+)$/i.exec(rule.trim());
  if (m) {
    const idx = WEEKDAY_TO_INDEX[m[1].toLowerCase()];
    if (typeof idx === "number") return { weekly: idx };
  }
  return {};
}

function dateOnlyUTC(ymd: string): Date {
  // Anchor at noon UTC so timezones never shift the weekday.
  return new Date(`${ymd}T12:00:00Z`);
}

function fmt24(time: string | null | undefined, fallback: string): string {
  if (!time) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return fallback;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export async function resolveTutorOfDay(dateStr: string): Promise<TutorOfDay | null> {
  const db = getDb();
  const day = dateOnlyUTC(dateStr);
  const weekday = day.getUTCDay();

  // ---- (1) concrete tutorSessions for that calendar date ----
  try {
    const startUtc = `${dateStr} 00:00:00`;
    const endUtc = `${dateStr} 23:59:59`;
    const rows: any[] = ((await db.execute(sql`
      SELECT ts.id, ts.tutorId, ts.scheduledAt, ts.durationMin, ts.focus, ts.status,
             t.name AS tutorName, t.role AS tutorRole
      FROM tutorSessions ts
      LEFT JOIN tutors t ON t.id = ts.tutorId
      WHERE ts.scheduledAt BETWEEN ${startUtc} AND ${endUtc}
        AND ts.status IN ('scheduled', 'completed', 'trial')
      ORDER BY ts.scheduledAt ASC
      LIMIT 1
    `)) as any)[0] ?? [];
    const first = rows[0];
    if (first) {
      const start = new Date(first.scheduledAt);
      const end = new Date(start.getTime() + (Number(first.durationMin) || 60) * 60_000);
      const hh = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return {
        name: String(first.tutorName || "Tutor"),
        role: first.tutorRole ? String(first.tutorRole) : "Tutor",
        arrival: hh(start),
        departure: hh(end),
        source: "tutor_session",
        sourceId: Number(first.id),
      };
    }
  } catch (err) {
    // tutorSessions may be empty in fresh dev DBs; safe to fall through.
  }

  // ---- (2) recurring appointments matching this weekday ----
  try {
    const apptRows: any[] = ((await db.execute(sql`
      SELECT id, title, contactName, recurrenceRule, startTime, endTime, leaveTime, returnTime
      FROM appointments
      WHERE active = TRUE
    `)) as any)[0] ?? [];
    for (const a of apptRows) {
      const rec = parseRecurrence(a.recurrenceRule);
      if (rec.weekly !== weekday) continue;
      const arrival = fmt24(a.leaveTime || a.startTime, "10:00");
      const departure = fmt24(a.returnTime || a.endTime, "11:00");
      return {
        name: String(a.contactName || a.title || "Appointment"),
        role: a.title ? String(a.title) : "Appointment",
        arrival,
        departure,
        source: "appointment",
        sourceId: Number(a.id),
      };
    }
  } catch {
    /* best-effort */
  }

  return null;
}

/**
 * Same as resolveTutorOfDay but returns a one-line label for printable PDFs
 * and email subject lines. Pure formatting, no DB hit.
 */
export function tutorOfDayLabel(t: TutorOfDay | null): string {
  if (!t) return "No tutor today — Mom only";
  const role = t.role ? ` (${t.role})` : "";
  return `${t.name}${role} · ${t.arrival}–${t.departure}`;
}
