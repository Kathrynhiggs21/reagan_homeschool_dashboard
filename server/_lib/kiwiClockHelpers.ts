/**
 * Wave-15 / Push 279 — kiwiClockHelpers
 *
 * Pure helpers to derive (localHour, dayIndex) from a UTC ms
 * timestamp + IANA timezone. The chat UI uses these to feed
 * the greeting composer (Push 277) without writing date math.
 *
 * - localHour: integer 0..23 in the given timezone
 * - dayIndex: integer count of days since epoch in the given
 *   timezone (used as the rotation seed for daily greetings)
 *
 * Pure: no I/O, no clock. Uses Intl.DateTimeFormat for tz parts.
 * Invalid timezone falls back to UTC (deterministic).
 */

export interface KiwiClockParts {
  localHour: number;
  dayIndex: number;
  localYear: number;
  localMonth: number; // 1..12
  localDay: number; // 1..31
  timeZone: string;
}

function safeTimeZone(tz: string | undefined | null): string {
  if (!tz || typeof tz !== "string") return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function deriveKiwiClockParts(
  nowUtcMs: number,
  timeZone: string | undefined | null,
): KiwiClockParts {
  const tz = safeTimeZone(timeZone);
  const ts = Number.isFinite(nowUtcMs) && nowUtcMs >= 0 ? nowUtcMs : 0;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ts));
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10) || 1970;
    else if (p.type === "month") month = parseInt(p.value, 10) || 1;
    else if (p.type === "day") day = parseInt(p.value, 10) || 1;
    else if (p.type === "hour") {
      const h = parseInt(p.value, 10);
      // Intl can emit "24" for hour-cycle h23 representing midnight; normalize.
      hour = Number.isFinite(h) ? (h === 24 ? 0 : h) : 0;
    }
  }
  // dayIndex via UTC of the local midnight (stable, monotonic, tz-aware)
  const localMidnightUtcMs = Date.UTC(year, month - 1, day);
  const dayIndex = Math.floor(localMidnightUtcMs / 86400000);
  return {
    localHour: hour,
    dayIndex,
    localYear: year,
    localMonth: month,
    localDay: day,
    timeZone: tz,
  };
}
