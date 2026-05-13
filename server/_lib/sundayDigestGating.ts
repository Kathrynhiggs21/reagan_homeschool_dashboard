/**
 * Push 108 (2026-05-13) — Sunday-only digest gating pure helper.
 *
 * The Sunday weekly digest cron currently fires on a fixed cron line.
 * We still want the *application* to be the source of truth on whether
 * "right now" qualifies as a digest-send moment, because:
 *   - DST shifts can move the cron's wall-clock time
 *   - manual replays / test runs / Run Now from the schedules panel
 *     should not double-send if the previous send already fired today
 *   - the cron may briefly retry on transient failures
 *
 * This helper centralizes the predicate "is this an allowed Sunday-7pm
 * digest moment in family TZ (America/New_York)?" so every entry-point
 * agrees: cron tick, manual Run Now, replay-from-failure.
 *
 * Pure module — deterministic, no DB, no I/O. Caller passes `now` and
 * (optionally) `lastSentAtIso` so tests can pin every clock moment.
 */

export const FAMILY_TIMEZONE = "America/New_York";

/** Window the digest is allowed to send: Sun 19:00–20:30 family-local. */
export const DIGEST_WINDOW_START_HOUR_LOCAL = 19; // 7:00 PM
export const DIGEST_WINDOW_END_HOUR_LOCAL = 20; // exclusive at 21:00
export const DIGEST_WINDOW_END_MINUTE_LOCAL = 30; // up through 20:30

export type DigestGateOutcome =
  | { allow: true; reason: "in-window-and-not-yet-sent" }
  | { allow: false; reason: "not-sunday" }
  | { allow: false; reason: "before-window" }
  | { allow: false; reason: "after-window" }
  | { allow: false; reason: "already-sent-this-week" }
  | { allow: false; reason: "invalid-now" };

interface FamilyLocalParts {
  weekday: number; // 0=Sun..6=Sat
  hour: number;
  minute: number;
  isoDate: string; // YYYY-MM-DD in family TZ
}

function familyLocalParts(now: Date): FamilyLocalParts | null {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  // Use Intl with weekday + en-CA for ISO-style date portion.
  const fmtParts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const p of fmtParts) lookup[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[lookup.weekday] ?? -1;
  if (weekday < 0) return null;
  // hour can come back as "24" in en-US hour12:false on midnight; clamp.
  let hour = parseInt(lookup.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(lookup.minute, 10);
  const isoDate = `${lookup.year}-${lookup.month}-${lookup.day}`;
  return { weekday, hour, minute, isoDate };
}

/**
 * Returns the family-local ISO date (YYYY-MM-DD) that an arbitrary
 * timestamp falls on. Useful to compare "did we already send a digest
 * during this Sunday in family time?".
 */
export function familyLocalDateOf(now: Date): string | null {
  const parts = familyLocalParts(now);
  return parts?.isoDate ?? null;
}

export function evaluateSundayDigestGate(input: {
  now: Date;
  lastSentAtIso?: string | null;
}): DigestGateOutcome {
  const parts = familyLocalParts(input.now);
  if (!parts) return { allow: false, reason: "invalid-now" };

  if (parts.weekday !== 0) return { allow: false, reason: "not-sunday" };

  // Build numeric "minute-of-day" for window comparison.
  const nowMin = parts.hour * 60 + parts.minute;
  const startMin = DIGEST_WINDOW_START_HOUR_LOCAL * 60;
  const endMin =
    DIGEST_WINDOW_END_HOUR_LOCAL * 60 + DIGEST_WINDOW_END_MINUTE_LOCAL;

  if (nowMin < startMin) return { allow: false, reason: "before-window" };
  if (nowMin > endMin) return { allow: false, reason: "after-window" };

  // Idempotency: if we already sent today (same family-local ISO date),
  // bail out so cron retries / manual replays don't double-send.
  if (input.lastSentAtIso) {
    const last = new Date(input.lastSentAtIso);
    const lastDate = familyLocalDateOf(last);
    if (lastDate && lastDate === parts.isoDate) {
      return { allow: false, reason: "already-sent-this-week" };
    }
  }

  return { allow: true, reason: "in-window-and-not-yet-sent" };
}
