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
import { GoogleCalendarClient, type GCalEventResource } from "./googleCalendarClient";
import { resolveCalendarAccessToken } from "./googleCalendarAuth";
import { listBlocksForPlan, getPlanByDate, getAppSetting } from "../db";

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
  opts: { fetchImpl?: typeof fetch } = {},
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

  const fetchImpl = opts.fetchImpl ?? fetch;
  const summary: CalendarSyncSummary = {
    status: "synced",
    dateISO,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    attendeesInvited: 0,
    errorCount: 0,
  };

  try {
    // Target the documented "Reagan's Homeschool" calendar by default
    // (owner spear.cpt@gmail.com). Env override wins; then app setting; then
    // the known group-calendar id; "primary" only as a last resort.
    const calSetting = (await getAppSetting("calendar.id").catch(() => null)) || null;
    const calendarId =
      (process.env.GOOGLE_CALENDAR_TARGET_ID || "").trim() ||
      (calSetting || "").trim() ||
      "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com";
    const timeZone = (process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/New_York").trim() || "America/New_York";
    const tutorEmail = (await getAppSetting("tutorEmail").catch(() => null)) || null;

    const { accessToken } = await resolveCalendarAccessToken(fetchImpl);
    const client = new GoogleCalendarClient(accessToken, fetchImpl);

    // Pull the day's blocks from the dashboard (source of truth).
    const plan = await getPlanByDate(dateISO);
    const blocks = plan ? await listBlocksForPlan(plan.id) : [];
    const timedBlocks = (blocks as any[]).filter((b) => typeof b.startTime === "string" && /^\d{1,2}:\d{2}$/.test(b.startTime));

    // Day window in the target timezone, used for the soft-delete sweep.
    const dayStart = buildRfc3339(dateISO, "00:00", timeZone);
    const dayEnd = buildRfc3339(dateISO, "23:59", timeZone);

    // Existing dashboard-owned events on the calendar for this day.
    const existing = await client.listEvents({
      calendarId,
      timeMin: dayStart,
      timeMax: dayEnd,
      privateExtendedProperty: `${SYNC_TAG_KEY}=1`,
    });
    const existingByBlockId = new Map<string, GCalEventResource>();
    for (const ev of existing) {
      const bid = ev.extendedProperties?.private?.dashboardBlockId;
      if (bid) existingByBlockId.set(bid, ev);
    }

    const liveBlockIds = new Set<string>();

    for (const b of timedBlocks) {
      const blockId = String(b.id);
      liveBlockIds.add(blockId);
      const resource = buildEventResource(b, dateISO, { timeZone, tutorEmail });
      if (resource.attendees && resource.attendees.length > 0) summary.attendeesInvited += resource.attendees.length;

      try {
        const match = existingByBlockId.get(blockId);
        if (match && match.id) {
          await client.patchEvent(calendarId, match.id, resource);
          summary.eventsUpdated += 1;
        } else {
          await client.insertEvent(calendarId, resource);
          summary.eventsCreated += 1;
        }
      } catch (err: any) {
        summary.errorCount += 1;
        // eslint-disable-next-line no-console
        console.error(`[calendarSync] block ${blockId} upsert failed:`, err?.message || err);
      }
    }

    // Soft-delete: any dashboard-owned event whose block is gone.
    for (const [bid, ev] of Array.from(existingByBlockId.entries())) {
      if (!liveBlockIds.has(bid) && ev.id) {
        try {
          await client.deleteEvent(calendarId, ev.id);
          summary.eventsDeleted += 1;
        } catch (err: any) {
          summary.errorCount += 1;
          // eslint-disable-next-line no-console
          console.error(`[calendarSync] stale event ${ev.id} delete failed:`, err?.message || err);
        }
      }
    }
  } catch (err: any) {
    summary.errorCount += 1;
    summary.reason = err?.message || String(err);
  }

  summary.status = summary.errorCount > 0 ? "synced_with_errors" : "synced";
  return summary;
}

/* =====================================================================
   Time + event-resource helpers
   ===================================================================== */

/** Stable marker so the sweep only ever touches events WE created. */
export const SYNC_TAG_KEY = "reaganHomeschoolSync";

/**
 * America/New_York UTC offset (in minutes, e.g. -240 for EDT, -300 for
 * EST) for a given local date+time, derived via Intl so DST is handled
 * correctly without a tz library. Returns the offset string like
 * "-04:00".
 */
export function tzOffsetString(dateISO: string, hhmm: string, timeZone: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  // Construct a UTC date for the wall-clock time, then ask Intl what that
  // instant looks like in the target zone to recover the offset.
  const asUtc = new Date(`${dateISO}T${pad2(h)}:${pad2(m)}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(asUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMin = Math.round((localAsUtc - asUtc.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an RFC3339 datetime string for date+HH:MM in the given tz. */
export function buildRfc3339(dateISO: string, hhmm: string, timeZone: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const offset = tzOffsetString(dateISO, hhmm, timeZone);
  return `${dateISO}T${pad2(h)}:${pad2(m)}:00${offset}`;
}

/** Add minutes to an HH:MM clock string (wraps within the same day). */
export function addMinutesHHMM(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.max(0, h * 60 + m + mins);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

/**
 * Build a Google Calendar event resource from a dashboard block + plan
 * date. Stamps the sync marker + dashboardBlockId for idempotency and
 * the soft-delete sweep.
 */
export function buildEventResource(
  block: { id: number; title: string; description?: string | null; startTime: string; durationMin: number; blockType?: string | null; tags?: string[] | null },
  dateISO: string,
  opts: { timeZone: string; tutorEmail?: string | null },
): GCalEventResource {
  const startHHMM = block.startTime;
  const endHHMM = addMinutesHHMM(startHHMM, Math.max(1, block.durationMin || 30));
  const isTutorBlock =
    block.blockType === "tutor" ||
    (Array.isArray(block.tags) && block.tags.includes("tutor"));

  const resource: GCalEventResource = {
    summary: `[Reagan Homeschool] ${block.title}`.slice(0, 250),
    description: `${(block.description ?? "").slice(0, 3800)}\n\n— Reagan Homeschool Dashboard (auto-sync)`,
    start: { dateTime: buildRfc3339(dateISO, startHHMM, opts.timeZone), timeZone: opts.timeZone },
    end: { dateTime: buildRfc3339(dateISO, endHHMM, opts.timeZone), timeZone: opts.timeZone },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
    extendedProperties: {
      private: { [SYNC_TAG_KEY]: "1", dashboardBlockId: String(block.id) },
    },
  };

  if (isTutorBlock && opts.tutorEmail) {
    const trimmed = opts.tutorEmail.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      resource.attendees = [{ email: trimmed }];
    }
  }

  return resource;
}

/**
 * Sync an inclusive range of dates [startISO, endISO]. Skips weekends
 * automatically (the dashboard has no blocks there). Returns a rolled-up
 * summary plus per-day breakdown.
 */
export async function runCalendarSyncForRange(
  startISO: string,
  endISO: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{ totals: CalendarSyncSummary; days: CalendarSyncSummary[] }> {
  const days: CalendarSyncSummary[] = [];
  const cur = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    const iso = cur.toISOString().slice(0, 10);
    days.push(await runCalendarSyncForDate(iso, opts));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  const totals: CalendarSyncSummary = {
    status: days.some((d) => d.status === "synced_with_errors") ? "synced_with_errors" : "synced",
    dateISO: `${startISO}..${endISO}`,
    eventsCreated: days.reduce((a, d) => a + d.eventsCreated, 0),
    eventsUpdated: days.reduce((a, d) => a + d.eventsUpdated, 0),
    eventsDeleted: days.reduce((a, d) => a + d.eventsDeleted, 0),
    attendeesInvited: days.reduce((a, d) => a + d.attendeesInvited, 0),
    errorCount: days.reduce((a, d) => a + d.errorCount, 0),
  };
  return { totals, days };
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

/* =====================================================================
   Connection probe — tells the UI exactly where we stand
   ===================================================================== */

export type CalendarConnectionProbe = {
  /** "ready" only when we can actually WRITE to the target calendar. */
  status: "no_credentials" | "calendar_unreachable" | "read_only" | "writable";
  /** Resolved calendar id we are probing. */
  targetCalendarId: string;
  /** The service-account / token identity (email) to share the calendar with, when known. */
  shareWithEmail: string | null;
  /** Human-readable summary of the current state. */
  message: string;
  /** Raw HTTP status from the write probe, for debugging (null when not attempted). */
  writeProbeStatus: number | null;
};

function resolveTargetCalendarIdSync(calSetting: string | null): string {
  return (
    (process.env.GOOGLE_CALENDAR_TARGET_ID || "").trim() ||
    (calSetting || "").trim() ||
    "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com"
  );
}

/** Best-effort extraction of the credential's identity email (service account). */
function credentialIdentityEmail(): string | null {
  const sa = (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || "").trim();
  if (sa.includes("client_email")) {
    try {
      const parsed = JSON.parse(sa);
      if (parsed && typeof parsed.client_email === "string") return parsed.client_email;
    } catch {
      const m = sa.match(/"client_email"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * Probe whether the configured credential can actually WRITE to the
 * target calendar. Non-destructive: it reads the calendar metadata, then
 * inserts a tiny marker event and immediately deletes it. A 403 on
 * insert means the calendar is shared read-only (the common
 * service-account case before "Make changes to events" is granted).
 *
 * Never throws — always resolves to a structured probe result the UI can
 * render and poll.
 */
export async function probeCalendarConnection(
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<CalendarConnectionProbe> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const calSetting = (await getAppSetting("calendar.id").catch(() => null)) || null;
  const targetCalendarId = resolveTargetCalendarIdSync(calSetting);
  const shareWithEmail = credentialIdentityEmail();

  const cred = getCalendarCredentialStatus();
  if (cred.kind !== "ready") {
    return {
      status: "no_credentials",
      targetCalendarId,
      shareWithEmail,
      writeProbeStatus: null,
      message:
        "No Google Calendar credential is configured yet. Add the service-account JSON or an OAuth token in Settings → Secrets.",
    };
  }

  let accessToken: string;
  try {
    ({ accessToken } = await resolveCalendarAccessToken(fetchImpl));
  } catch (e: any) {
    return {
      status: "calendar_unreachable",
      targetCalendarId,
      shareWithEmail,
      writeProbeStatus: null,
      message: `Could not mint a Google access token from the credential: ${e?.message || "unknown error"}.`,
    };
  }

  const client = new GoogleCalendarClient(accessToken, fetchImpl);
  const timeZone = (process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/New_York").trim() || "America/New_York";

  // Step 1: can we READ the calendar at all? (list a tiny window)
  const today = new Date().toISOString().slice(0, 10);
  try {
    await client.listEvents({
      calendarId: targetCalendarId,
      timeMin: buildRfc3339(today, "00:00", timeZone),
      timeMax: buildRfc3339(today, "00:01", timeZone),
      maxResults: 1,
    });
  } catch (e: any) {
    return {
      status: "calendar_unreachable",
      targetCalendarId,
      shareWithEmail,
      writeProbeStatus: e?.status ?? null,
      message: `The credential can't reach calendar "${targetCalendarId}". Make sure the calendar exists and is shared with ${shareWithEmail || "the credential"}.`,
    };
  }

  // Step 2: can we WRITE? Insert a throwaway marker event, then delete it.
  const probeEvent: GCalEventResource = {
    summary: "[setup check — safe to ignore]",
    description: "Temporary write-access probe created by Reagan's Homeschool Dashboard. Auto-deleted immediately.",
    start: { dateTime: buildRfc3339(today, "00:00", timeZone), timeZone },
    end: { dateTime: buildRfc3339(today, "00:01", timeZone), timeZone },
    extendedProperties: { private: { [SYNC_TAG_KEY]: "probe" } },
  };
  try {
    const created = await client.insertEvent(targetCalendarId, probeEvent);
    // Clean up immediately so we never leave a stray event behind.
    if (created?.id) {
      try {
        await client.deleteEvent(targetCalendarId, created.id);
      } catch {
        /* best-effort cleanup; ignore */
      }
    }
    return {
      status: "writable",
      targetCalendarId,
      shareWithEmail,
      writeProbeStatus: 200,
      message: "Connected. The dashboard can write events to the calendar — you're ready to sync.",
    };
  } catch (e: any) {
    const code = e?.status ?? null;
    if (code === 403) {
      return {
        status: "read_only",
        targetCalendarId,
        shareWithEmail,
        writeProbeStatus: 403,
        message: shareWithEmail
          ? `Almost there — the calendar is shared with ${shareWithEmail} as read-only. Change its permission to "Make changes to events" and re-check.`
          : `Almost there — the credential has read-only access. Grant it "Make changes to events" on the calendar and re-check.`,
      };
    }
    return {
      status: "calendar_unreachable",
      targetCalendarId,
      shareWithEmail,
      writeProbeStatus: code,
      message: `Write probe failed: ${e?.message || "unknown error"}.`,
    };
  }
}
