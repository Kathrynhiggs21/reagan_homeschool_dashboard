/**
 * Push 124 (2026-05-13) — Sunday digest send-plan orchestrator contract.
 *
 * Pins the orchestration glue between gate, recipients toggle, dedupe,
 * and the audience-aware body composer. Once this passes, the eventual
 * cron/SMTP layer only has to call planSundayDigestSend() and walk the
 * resulting `sends` array.
 */
import { describe, it, expect } from "vitest";
import {
  planSundayDigestSend,
  type PlanSundayDigestInput,
} from "./_lib/sundayDigestSendPlan";
import type { DigestSnapshot } from "./_lib/sundayDigestBody";

// A Sunday at 19:30 America/New_York → 23:30 UTC during EST. Use a
// Sunday in May (EDT) → Sunday 19:30 EDT === Sunday 23:30 UTC.
// 2026-05-10 is a Sunday. 19:30 EDT = 23:30 UTC = 1746919800000.
const SUNDAY_INSIDE_WINDOW_MS = Date.parse("2026-05-10T23:30:00Z");
const MONDAY_OUTSIDE_WINDOW_MS = Date.parse("2026-05-11T23:30:00Z");
const SUNDAY_BEFORE_WINDOW_MS = Date.parse("2026-05-10T22:00:00Z"); // 18:00 EDT

const SNAPSHOT: DigestSnapshot = {
  weekStartIso: "2026-05-04T00:00:00Z",
  weekEndIso: "2026-05-10T23:59:00Z",
  subjectHours: { math: 4.5, ela: 3, science: 2 },
  moodSummary: {
    greenShare: 0.7,
    yellowShare: 0.25,
    redShare: 0.05,
    headline: "Mostly settled week.",
  },
  iepCoverageNote: "Decoding probe at 92%.",
  offPlanCaptures: ["Backyard ladybug count"],
  mondayPreview: "Math: long division warm-up.",
};

function baseInput(over: Partial<PlanSundayDigestInput> = {}): PlanSundayDigestInput {
  return {
    snapshot: SNAPSHOT,
    grandmaEnabled: true,
    nowMs: SUNDAY_INSIDE_WINDOW_MS,
    lastSentAtIso: null,
    alreadyQueuedKeys: [],
    ...over,
  };
}

describe("Push 124 — planSundayDigestSend", () => {
  it("inside Sunday window with Grandma enabled queues Mom + Grandma in that order", () => {
    const out = planSundayDigestSend(baseInput());
    expect(out.skipReason).toBeNull();
    expect(out.sends.map((s) => s.role)).toEqual(["mom", "grandma"]);
    expect(out.sends[0].toEmail).toBe("reaganhiggs910@gmail.com");
    expect(out.sends[1].toEmail).toBe("marcy.spear@gmail.com");
  });

  it("Mom send uses 'mom' audience body; Grandma send uses 'grandma' audience body", () => {
    const out = planSundayDigestSend(baseInput());
    const mom = out.sends.find((s) => s.role === "mom")!;
    const gma = out.sends.find((s) => s.role === "grandma")!;
    expect(mom.audience).toBe("mom");
    expect(gma.audience).toBe("grandma");
    expect(mom.subject).toMatch(/Weekly digest/);
    expect(gma.subject).toMatch(/Reagan's week with Mom/);
  });

  it("Grandma greeting only appears in Grandma's body, not Mom's", () => {
    const out = planSundayDigestSend(baseInput());
    const mom = out.sends.find((s) => s.role === "mom")!;
    const gma = out.sends.find((s) => s.role === "grandma")!;
    const momGreets = mom.body.sections.some((s) => s.kind === "greeting");
    const gmaGreets = gma.body.sections.some((s) => s.kind === "greeting");
    expect(momGreets).toBe(false);
    expect(gmaGreets).toBe(true);
  });

  it("Monday preview only appears for Mom", () => {
    const out = planSundayDigestSend(baseInput());
    const mom = out.sends.find((s) => s.role === "mom")!;
    const gma = out.sends.find((s) => s.role === "grandma")!;
    expect(mom.body.sections.some((s) => s.kind === "mondayPreview")).toBe(true);
    expect(gma.body.sections.some((s) => s.kind === "mondayPreview")).toBe(false);
  });

  it("muting Grandma drops her from sends and surfaces the banner", () => {
    const out = planSundayDigestSend(baseInput({ grandmaEnabled: false }));
    expect(out.sends.map((s) => s.role)).toEqual(["mom"]);
    expect(out.grandmaMutedBanner.show).toBe(true);
    if (out.grandmaMutedBanner.show) {
      expect(out.grandmaMutedBanner.message).toMatch(/Grandma is muted/);
    }
  });

  it("Monday (outside Sunday) skips with outside-send-window", () => {
    const out = planSundayDigestSend(baseInput({ nowMs: MONDAY_OUTSIDE_WINDOW_MS }));
    expect(out.sends).toEqual([]);
    expect(out.skipReason).toBe("outside-send-window");
  });

  it("Sunday before 19:00 EDT skips with outside-send-window", () => {
    const out = planSundayDigestSend(baseInput({ nowMs: SUNDAY_BEFORE_WINDOW_MS }));
    expect(out.sends).toEqual([]);
    expect(out.skipReason).toBe("outside-send-window");
  });

  it("already-sent-this-week (same family-local ISO date) skips", () => {
    const out = planSundayDigestSend(
      baseInput({
        // Last send was 5 minutes earlier in the same window → same date.
        lastSentAtIso: new Date(SUNDAY_INSIDE_WINDOW_MS - 5 * 60 * 1000).toISOString(),
      }),
    );
    expect(out.sends).toEqual([]);
    expect(out.skipReason).toBe("already-sent-this-week");
  });

  it("invalid nowMs (NaN) returns invalid-now skip", () => {
    const out = planSundayDigestSend(baseInput({ nowMs: NaN }));
    expect(out.sends).toEqual([]);
    expect(out.skipReason).toBe("invalid-now");
  });

  it("idempotency: pre-queued Mom key is dropped, Grandma still queued", () => {
    const momKey = `2026-05-04:reaganhiggs910@gmail.com`;
    const out = planSundayDigestSend(
      baseInput({ alreadyQueuedKeys: [momKey] }),
    );
    expect(out.sends.map((s) => s.role)).toEqual(["grandma"]);
  });

  it("idempotency: both pre-queued ⇒ all-recipients-already-queued skip", () => {
    const out = planSundayDigestSend(
      baseInput({
        alreadyQueuedKeys: [
          `2026-05-04:reaganhiggs910@gmail.com`,
          `2026-05-04:marcy.spear@gmail.com`,
        ],
      }),
    );
    expect(out.sends).toEqual([]);
    expect(out.skipReason).toBe("all-recipients-already-queued");
  });

  it("extras append after Mom + Grandma in order, dedupe by email case-insensitive", () => {
    const out = planSundayDigestSend(
      baseInput({
        extras: [
          { email: "Dad@example.com", displayName: "Dad", role: "family-admin" },
          // Duplicate of Grandma's email in different case → skipped
          { email: "MARCY.SPEAR@gmail.com", displayName: "Dup", role: "family-admin" },
        ],
      }),
    );
    expect(out.sends.map((s) => s.toEmail.toLowerCase())).toEqual([
      "reaganhiggs910@gmail.com",
      "marcy.spear@gmail.com",
      "dad@example.com",
    ]);
  });

  it("extras get an audience inferred from email (Dad → 'mom' if marked mom-tier addr; otherwise viewer)", () => {
    const out = planSundayDigestSend(
      baseInput({
        extras: [
          { email: "tutor1@tbd.local", displayName: "Madison", role: "family-admin" },
        ],
      }),
    );
    const tutor = out.sends.find((s) => s.toEmail === "tutor1@tbd.local")!;
    expect(tutor.audience).toBe("tutor");
  });

  it("idempotency key shape is 'YYYY-MM-DD:lowercase-email' from weekStartIso", () => {
    const out = planSundayDigestSend(baseInput());
    expect(out.sends[0].idempotencyKey).toBe(
      "2026-05-04:reaganhiggs910@gmail.com",
    );
    expect(out.sends[1].idempotencyKey).toBe(
      "2026-05-04:marcy.spear@gmail.com",
    );
  });

  it("subject line and body subject agree (single source of truth)", () => {
    const out = planSundayDigestSend(baseInput());
    for (const s of out.sends) {
      expect(s.subject).toBe(s.body.subject);
    }
  });

  it("gate evaluation is included in the result for ops visibility", () => {
    const out = planSundayDigestSend(baseInput());
    expect(out.gate.allow).toBe(true);
    if (out.gate.allow) {
      expect(out.gate.reason).toBe("in-window-and-not-yet-sent");
    }
  });
});
