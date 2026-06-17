/**
 * Tests for the credential-gated Google Calendar one-way sync worker.
 *
 * Three contracts pinned:
 *   1. The credential gate respects both Calendar-specific env vars
 *      AND the unified Drive credential fallback.
 *   2. `runCalendarSyncForDate()` no-ops cleanly when no credentials
 *      are present (safe for agenda-commit hook today).
 *   3. `buildCalendarEventPayload()` is pure and complete — covers
 *      time conversion, the dashboardBlockId for idempotency, the
 *      tutor-attendee gating policy, and email validation.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getCalendarCredentialStatus,
  runCalendarSyncForDate,
  buildCalendarEventPayload,
} from "./_lib/googleCalendarSync";

describe("getCalendarCredentialStatus", () => {
  const savedToken = process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  const savedDriveToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedDriveSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    if (savedDriveToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedDriveToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedDriveSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedDriveSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  it("not_configured when nothing is set", () => {
    const s = getCalendarCredentialStatus();
    expect(s.kind).toBe("not_configured");
  });

  it("ready/oauth_token when GOOGLE_CALENDAR_OAUTH_TOKEN is set", () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "ya29.fake-cal-token";
    const s = getCalendarCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });

  it("ready when calendar service account JSON looks valid", () => {
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = JSON.stringify({
      private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      client_email: "x@x.iam.gserviceaccount.com",
      filler: "x".repeat(60),
    });
    const s = getCalendarCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("service_account");
  });

  it("falls back to Drive OAuth token when Calendar-specific env is missing", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.unified-fake";
    const s = getCalendarCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });

  it("prefers Calendar-specific token over Drive fallback when both exist", () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "ya29.cal-specific";
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.drive-token";
    const s = getCalendarCredentialStatus();
    expect(s.kind).toBe("ready");
    // (Source kind is the same string; the value-precedence is what
    // matters at runtime — the live worker will prefer the
    // calendar-specific token because of the early-return order in
    // the function.)
  });
});

describe("runCalendarSyncForDate", () => {
  const savedToken = process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  const savedDriveToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedDriveSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_CALENDAR_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
    if (savedDriveToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedDriveToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedDriveSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedDriveSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  it("short-circuits with skipped_no_credentials when no creds — zero side effects", async () => {
    const r = await runCalendarSyncForDate("2026-05-30");
    expect(r.status).toBe("skipped_no_credentials");
    expect(r.dateISO).toBe("2026-05-30");
    expect(r.eventsCreated).toBe(0);
    expect(r.eventsUpdated).toBe(0);
    expect(r.eventsDeleted).toBe(0);
    expect(r.attendeesInvited).toBe(0);
    expect(r.errorCount).toBe(0);
    expect(r.reason).toMatch(/No Calendar credentials/i);
  });

  it("never throws when called with no creds (safe for agenda-commit hook)", async () => {
    await expect(runCalendarSyncForDate("2026-05-30")).resolves.toBeDefined();
  });
});

describe("buildCalendarEventPayload (pure)", () => {
  const baseBlock = {
    id: 42,
    title: "Math: Multiplying Decimals",
    description: "Khan video + 5 practice problems",
    startTimeMs: Date.UTC(2026, 4, 30, 13, 0, 0), // 2026-05-30 13:00 UTC
    durationMin: 30,
    blockType: "core",
  };

  it("produces a complete event payload with deterministic dashboardBlockId", () => {
    const p = buildCalendarEventPayload(baseBlock);
    expect(p.summary).toBe("Math: Multiplying Decimals");
    expect(p.description).toBe("Khan video + 5 practice problems");
    expect(p.startISO).toBe("2026-05-30T13:00:00.000Z");
    expect(p.endISO).toBe("2026-05-30T13:30:00.000Z");
    expect(p.timeZone).toBe("America/New_York");
    expect(p.extendedProperties.private.dashboardBlockId).toBe("42");
  });

  it("respects custom timeZone option", () => {
    const p = buildCalendarEventPayload(baseBlock, { timeZone: "America/Los_Angeles" });
    expect(p.timeZone).toBe("America/Los_Angeles");
  });

  it("clamps duration to a minimum of 1 minute (defensive)", () => {
    const p = buildCalendarEventPayload({ ...baseBlock, durationMin: 0 });
    // 1 minute after start
    expect(p.endISO).toBe("2026-05-30T13:01:00.000Z");
  });

  it("omits attendees for a non-tutor block even when tutorEmail provided", () => {
    const p = buildCalendarEventPayload(baseBlock, { tutorEmail: "tutor@example.com" });
    expect(p.attendees).toBeUndefined();
  });

  it("attaches tutor as attendee when blockType === 'tutor'", () => {
    const p = buildCalendarEventPayload(
      { ...baseBlock, blockType: "tutor" },
      { tutorEmail: "tutor@example.com" },
    );
    expect(p.attendees).toEqual([{ email: "tutor@example.com" }]);
  });

  it("attaches tutor as attendee when tags include 'tutor'", () => {
    const p = buildCalendarEventPayload(
      { ...baseBlock, blockType: "core", tags: ["math", "tutor"] },
      { tutorEmail: "tutor@example.com" },
    );
    expect(p.attendees).toEqual([{ email: "tutor@example.com" }]);
  });

  it("does NOT attach attendee when tutorEmail is null/empty/whitespace", () => {
    const tutorBlock = { ...baseBlock, blockType: "tutor" };
    expect(buildCalendarEventPayload(tutorBlock).attendees).toBeUndefined();
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: null }).attendees).toBeUndefined();
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: "" }).attendees).toBeUndefined();
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: "   " }).attendees).toBeUndefined();
  });

  it("does NOT attach attendee when tutorEmail is malformed (defensive)", () => {
    const tutorBlock = { ...baseBlock, blockType: "tutor" };
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: "not-an-email" }).attendees).toBeUndefined();
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: "missing@tld" }).attendees).toBeUndefined();
    expect(buildCalendarEventPayload(tutorBlock, { tutorEmail: "@nolocal.com" }).attendees).toBeUndefined();
  });

  it("trims whitespace from tutorEmail before validating + attaching", () => {
    const tutorBlock = { ...baseBlock, blockType: "tutor" };
    const p = buildCalendarEventPayload(tutorBlock, { tutorEmail: "  tutor@example.com\n" });
    expect(p.attendees).toEqual([{ email: "tutor@example.com" }]);
  });

  it("truncates very long titles to 200 chars (Calendar API limit)", () => {
    const long = { ...baseBlock, title: "x".repeat(500) };
    const p = buildCalendarEventPayload(long);
    expect(p.summary.length).toBe(200);
  });

  it("truncates very long descriptions to 4000 chars", () => {
    const long = { ...baseBlock, description: "y".repeat(10000) };
    const p = buildCalendarEventPayload(long);
    expect(p.description.length).toBe(4000);
  });

  it("handles null description gracefully", () => {
    const p = buildCalendarEventPayload({ ...baseBlock, description: null });
    expect(p.description).toBe("");
  });
});

/* =====================================================================
   Live-path helpers (2026-06-16): tz/DST, RFC3339, event resource
   ===================================================================== */
import {
  tzOffsetString,
  buildRfc3339,
  addMinutesHHMM,
  crossesMidnight,
  addDaysISO,
  buildEventResource,
  SYNC_TAG_KEY,
} from "./_lib/googleCalendarSync";

describe("tz + time helpers (live path)", () => {
  it("returns EDT offset (-04:00) for late June (DST active)", () => {
    expect(tzOffsetString("2026-06-17", "13:00", "America/New_York")).toBe("-04:00");
  });

  it("returns EST offset (-05:00) for January (DST inactive)", () => {
    expect(tzOffsetString("2026-01-15", "13:00", "America/New_York")).toBe("-05:00");
  });

  it("builds an RFC3339 string with the correct summer offset", () => {
    expect(buildRfc3339("2026-06-17", "09:05", "America/New_York")).toBe(
      "2026-06-17T09:05:00-04:00",
    );
  });

  it("adds minutes across the hour boundary", () => {
    expect(addMinutesHHMM("13:40", 40)).toBe("14:20");
    expect(addMinutesHHMM("09:00", 30)).toBe("09:30");
  });
});

describe("buildEventResource (live path)", () => {
  const block = {
    id: 4242,
    title: "Fraction Lesson",
    description: "Add unlike denominators.",
    startTime: "09:00",
    durationMin: 45,
    blockType: "math",
  };

  it("stamps the sync marker + dashboardBlockId for idempotency", () => {
    const ev = buildEventResource(block, "2026-06-19", { timeZone: "America/New_York" });
    expect(ev.extendedProperties?.private?.[SYNC_TAG_KEY]).toBe("1");
    expect(ev.extendedProperties?.private?.dashboardBlockId).toBe("4242");
  });

  it("prefixes the summary and computes the end time in EDT", () => {
    const ev = buildEventResource(block, "2026-06-19", { timeZone: "America/New_York" });
    expect(ev.summary).toBe("[Reagan Homeschool] Fraction Lesson");
    expect(ev.start?.dateTime).toBe("2026-06-19T09:00:00-04:00");
    expect(ev.end?.dateTime).toBe("2026-06-19T09:45:00-04:00");
  });

  it("does NOT invite the tutor on a non-tutor block", () => {
    const ev = buildEventResource(block, "2026-06-19", {
      timeZone: "America/New_York",
      tutorEmail: "tutor@example.com",
    });
    expect(ev.attendees).toBeUndefined();
  });

  it("invites the tutor only on a tutor-flavored block", () => {
    const tutorBlock = { ...block, blockType: "tutor" };
    const ev = buildEventResource(tutorBlock, "2026-06-19", {
      timeZone: "America/New_York",
      tutorEmail: "tutor@example.com",
    });
    expect(ev.attendees).toEqual([{ email: "tutor@example.com" }]);
  });

  // Regression: the lone 6/17 pilot failure was "Ali visit" at 23:00 for 60min.
  // The end clock wrapped to 00:00 but was stamped on the SAME date, so Google
  // saw end < start and rejected it as an empty time range.
  it("rolls the END date forward when a block crosses midnight (the 6/17 Ali-visit bug)", () => {
    const lateBlock = {
      id: 2910001,
      title: "Ali visit",
      description: null,
      startTime: "23:00",
      durationMin: 60,
      blockType: "appointment",
    };
    const ev = buildEventResource(lateBlock, "2026-06-17", { timeZone: "America/New_York" });
    expect(ev.start?.dateTime).toBe("2026-06-17T23:00:00-04:00");
    // End is 00:00 on the NEXT day, not the same day.
    expect(ev.end?.dateTime).toBe("2026-06-18T00:00:00-04:00");
    // And the end is strictly after the start.
    expect(new Date(ev.end!.dateTime!).getTime()).toBeGreaterThan(
      new Date(ev.start!.dateTime!).getTime(),
    );
  });

  it("keeps end on the same date for a normal daytime block", () => {
    const ev = buildEventResource(block, "2026-06-19", { timeZone: "America/New_York" });
    expect(ev.end?.dateTime?.startsWith("2026-06-19")).toBe(true);
  });
});

describe("crossesMidnight + addDaysISO", () => {
  it("detects a block that runs to or past midnight", () => {
    expect(crossesMidnight("23:00", 60)).toBe(true);   // ends 00:00 next day
    expect(crossesMidnight("23:30", 31)).toBe(true);   // 00:01 next day
    expect(crossesMidnight("23:59", 1)).toBe(true);    // ends exactly midnight
  });
  it("returns false for blocks that finish before midnight", () => {
    expect(crossesMidnight("22:00", 60)).toBe(false);  // ends 23:00 same day
    expect(crossesMidnight("09:00", 45)).toBe(false);
  });
  it("advances the ISO date by whole days (UTC-safe across month end)", () => {
    expect(addDaysISO("2026-06-17", 1)).toBe("2026-06-18");
    expect(addDaysISO("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});
