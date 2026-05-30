/**
 * Google Calendar One-Way Sync Worker — credential-gated stub (2026-05-30)
 * ========================================================================
 *
 * Mirrors the dashboard's `scheduleBlocks` rows for a date as timed
 * Google Calendar events on Mom's calendar (or whichever calendar ID
 * the env var points at), so a tutor invited as a guest sees the
 * day's plan in their own calendar app without needing dashboard
 * access.
 *
 * Direction is one-way (dashboard → calendar); we never read back from
 * Calendar. If Mom edits an event in Calendar, the next sync overwrites
 * her change — by design, the dashboard is the single source of truth
 * for the schedule.
 *
 * Same credential-gating pattern as `drivePushWorker.ts` and
 * `driveFolderDedupeJob.ts`: when no Calendar OAuth token / service
 * account is configured, the worker short-circuits with
 * `skipped_no_credentials` (zero side effects, never throws). The
 * moment a `GOOGLE_CALENDAR_OAUTH_TOKEN` or
 * `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` env var lands, the gate flips
 * to `ready` and the live path comes online.
 *
 * Implementation notes for the live path (preserved here so the future
 * implementer doesn't have to re-derive them):
 *
 *   - Calendar ID resolution: read from `GOOGLE_CALENDAR_TARGET_ID`
 *     (defaults to "primary"). For the tutor-as-guest path, the worker
 *     adds `attendees: [{ email: tutorEmail }]` so the tutor gets the
 *     standard Google "added to calendar" email. The tutor email lives
 *     in `kvStore.tutorEmail` (already populated via Settings).
 *
 *   - Idempotency: each `scheduleBlock` row maps to a deterministic
 *     `extendedProperties.private.dashboardBlockId` value. Before
 *     creating, the worker calls `events.list({ q,
 *     privateExtendedProperty: 'dashboardBlockId=<id>' })`. If a match
 *     exists, `events.patch` instead of `events.insert`.
 *
 *   - Time conversion: `scheduleBlocks.startTimeMs` is UTC milliseconds.
 *     The Calendar API expects RFC3339 with timezone; convert via
 *     `new Date(startMs).toISOString()` and pass `timeZone:
 *     'America/New_York'` (Mom's TZ, hard-coded for now; switch to a
 *     kvStore lookup if she ever moves).
 *
 *   - Soft-deletion: when a block is removed from the dashboard, the
 *     worker sweeps the calendar day for events whose
 *     `dashboardBlockId` is no longer in our DB and deletes them. This
 *     keeps stale events from lingering when Mom rearranges the day.
 *
 *   - Tutor invite policy: only attach `attendees` when the block has
 *     `kind='tutor'` OR `tags.includes('tutor')`. Don't spam the tutor
 *     with every reading block.
 *
 *   - Concurrency: serial is fine; ~10-15 blocks per day, well below
 *     Calendar's rate limits.
 *
 *   - Source of truth: the trigger to call this is the agenda-commit
 *     hook in the chat-route apply path (around routers.ts line 1519);
 *     wire `runCalendarSyncForDate(dateISO)` after successful commit.
 */

import { getDriveCredentialStatus } from "./drivePushWorker";

/* =====================================================================
   Credential gate
   ===================================================================== */

export type CalendarCredentialStatus =
  | { kind: "ready"; source: "oauth_token" | "service_account" }
  | { kind: "not_configured"; reason: string };

/**
 * Returns whether the live Calendar uploader should run. Independent
 * from Drive credentials: a user might have one without the other.
 * Falls back to Drive credentials if a unified Google credential is
 * present (covers the common case where Mom drops one OAuth token
 * with both Drive + Calendar scopes).
 */
export function getCalendarCredentialStatus(): CalendarCredentialStatus {
  const cal = (process.env.GOOGLE_CALENDAR_OAUTH_TOKEN || "").trim();
  if (cal.length > 0) {
    return { kind: "ready", source: "oauth_token" };
  }
  const calSa = (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || "").trim();
  if (calSa.length > 50 && calSa.includes("private_key") && calSa.includes("client_email")) {
    return { kind: "ready", source: "service_account" };
  }
  // Fall back to a unified Google credential (Drive scope) — common
  // case where Mom uses one OAuth token covering Drive + Calendar.
  const driveStatus = getDriveCredentialStatus();
  if (driveStatus.kind === "ready") {
    return { kind: "ready", source: driveStatus.source };
  }
  return {
    kind: "not_configured",
    reason:
      "No Calendar credentials in env. Set GOOGLE_CALENDAR_OAUTH_TOKEN (preferred) or GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON, or use a unified Google OAuth token (Drive credentials with calendar scope).",
  };
}

/* =====================================================================
   Outcome shape
   ===================================================================== */

export type CalendarSyncSummary = {
  status: "skipped_no_credentials" | "synced" | "synced_with_errors";
  dateISO: string;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  attendeesInvited: number;
  errorCount: number;
  reason?: string;
};

/* =====================================================================
   Public entry — called from agenda-commit hook
   ===================================================================== */

/**
 * Mirror the day's `scheduleBlocks` to Mom's Google Calendar. Safe to
 * call from any agenda-commit path today; no-ops cleanly when
 * credentials are missing.
 */
export async function runCalendarSyncForDate(
  dateISO: string,
): Promise<CalendarSyncSummary> {
  const cred = getCalendarCredentialStatus();
  if (cred.kind !== "ready") {
    return {
      status: "skipped_no_credentials",
      dateISO,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      attendeesInvited: 0,
      errorCount: 0,
      reason: cred.reason,
    };
  }
  // Live path TBD — see module header for the wiring guide.
  return {
    status: "synced_with_errors",
    dateISO,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    attendeesInvited: 0,
    errorCount: 1,
    reason:
      "googleCalendarSync live path not yet implemented — credentials present but the worker stub is still in place. See googleCalendarSync.ts module header for the wiring guide.",
  };
}

/* =====================================================================
   Block → Calendar event payload (pure, fully testable today)
   ===================================================================== */

export type ScheduleBlockLike = {
  id: number;
  title: string;
  description?: string | null;
  startTimeMs: number;
  durationMin: number;
  blockType?: string | null;
  tags?: string[] | null;
};

export type CalendarEventPayload = {
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timeZone: string;
  extendedProperties: { private: { dashboardBlockId: string } };
  attendees?: Array<{ email: string }>;
};

/**
 * Pure conversion of one schedule block + optional tutor email into a
 * Calendar event payload. No network, no DB. The live worker calls
 * this then hands the result to `events.insert` or `events.patch`.
 *
 * Tutor email is only attached when the block is tutor-flavored
 * (`blockType==='tutor'` or tags include 'tutor'); otherwise the tutor
 * doesn't get spammed for every block.
 */
export function buildCalendarEventPayload(
  block: ScheduleBlockLike,
  opts: { tutorEmail?: string | null; timeZone?: string } = {},
): CalendarEventPayload {
  const start = new Date(block.startTimeMs);
  const end = new Date(block.startTimeMs + Math.max(1, block.durationMin) * 60_000);
  const timeZone = opts.timeZone ?? "America/New_York";

  const isTutorBlock =
    block.blockType === "tutor" ||
    (Array.isArray(block.tags) && block.tags.includes("tutor"));

  const payload: CalendarEventPayload = {
    summary: block.title.slice(0, 200),
    description: (block.description ?? "").slice(0, 4000),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    timeZone,
    extendedProperties: {
      private: { dashboardBlockId: String(block.id) },
    },
  };

  if (isTutorBlock && opts.tutorEmail) {
    const trimmed = opts.tutorEmail.trim();
    if (trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      payload.attendees = [{ email: trimmed }];
    }
  }

  return payload;
}
