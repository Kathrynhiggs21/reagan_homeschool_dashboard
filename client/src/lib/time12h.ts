/**
 * 12-hour AM/PM <-> 24-hour "HH:MM" string helpers.
 *
 * The DB / API layer stores time as the 24-hour "HH:MM" form (e.g. "13:00").
 * The UI for adults shows everything in 12-hour AM/PM ("1:00 PM"). These
 * helpers are the single source of truth for both directions.
 */

/**
 * Parse a flexible user-typed string into a 24-hour "HH:MM" canonical form.
 * Returns null if the input cannot be interpreted.
 *
 * Accepts:
 *   "9:00 AM", "9:00am", "9 am", "9am", "9", "9:30", "13:00", "1:30 PM",
 *   "12:00 AM" (midnight -> 00:00), "12:00 PM" (noon -> 12:00)
 */
export function parseTime12h(input: string | null | undefined): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Strip any internal whitespace except the AM/PM suffix.
  const m = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*([aApP][mM])?$/);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = m[2] != null ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase() ?? null;

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (ampm === "am") {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0; // 12:xx AM = 00:xx
  } else if (ampm === "pm") {
    if (hour < 1 || hour > 12) return null;
    if (hour !== 12) hour += 12; // 1-11 PM -> 13-23
  } else {
    // No AM/PM suffix.
    //   - Values 13-23 are unambiguous 24-hr.
    //   - Values 0-12 without a suffix: interpret 1-7 as PM (afternoon school
    //     hours feel wrong), but for a homeschool-day context we keep it
    //     literal — 9 means 9 AM, 1 means 1 PM is ambiguous, so we treat
    //     plain numbers 0-23 as 24-hour. This matches the 24-hour fallback
    //     adults already used. Adults who want PM should add "pm".
    if (hour < 0 || hour > 23) return null;
  }

  const hh = hour.toString().padStart(2, "0");
  const mm = minute.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Format a 24-hour "HH:MM" string (or null) for display as 12-hour AM/PM.
 * Returns "—" for null/empty/invalid input so the UI can render it directly.
 */
export function formatTime12h(value: string | null | undefined): string {
  if (!value) return "—";
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "—";
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min) || min < 0 || min > 59 || h < 0 || h > 23) return "—";

  const ampm = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const mm = min.toString().padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}
