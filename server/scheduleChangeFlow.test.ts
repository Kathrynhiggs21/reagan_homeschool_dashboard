/**
 * Push 126 (2026-05-13) — Schedule-change submit-to-approval flow contract.
 *
 * Pins the orchestration glue: kid submits a schedule-change request,
 * the endpoint calls planScheduleChangeFlow() and walks the returned
 * outbound SMS + banner state. Mom + Grandma both required, Dad FYI.
 */
import { describe, it, expect } from "vitest";
import { planScheduleChangeFlow } from "./_lib/scheduleChangeFlow";

const NOW = Date.parse("2026-05-13T15:00:00Z");

describe("Push 126 — planScheduleChangeFlow", () => {
  it("fresh submit → enqueue with Mom+Grandma required, Dad FYI", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Could we move math to after lunch?",
      nowMs: NOW,
    });
    expect(out.decision).toBe("submit-fresh");
    expect(out.enqueue).toBe(true);
    const required = out.outbound.filter((o) => o.required).map((o) => o.label);
    const fyi = out.outbound.filter((o) => !o.required).map((o) => o.label);
    expect(required.sort()).toEqual(["Grandma", "Mom"]);
    expect(fyi).toContain("Dad");
  });

  it("SMS line carries the SCHEDULE CHANGE prefix and the kid's body", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Could we move math to after lunch?",
      nowMs: NOW,
    });
    for (const o of out.outbound) {
      expect(o.smsLine).toContain("SCHEDULE CHANGE");
      expect(o.smsLine).toContain("after lunch");
    }
  });

  it("Reagan banner is kid-safe pending wording (no approver names)", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move art to morning?",
      nowMs: NOW,
    });
    expect(out.reaganBanner.shouldShow).toBe(true);
    expect(out.reaganBanner.kidSafe).toBe(true);
    expect(out.reaganBanner.text).not.toContain("Mom");
    expect(out.reaganBanner.text).not.toContain("Grandma");
  });

  it("Adult banner names both pending approvers", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move art to morning?",
      nowMs: NOW,
    });
    expect(out.adultBanner.text).toContain("Mom");
    expect(out.adultBanner.text).toContain("Grandma");
  });

  it("empty body → reject-empty-body, no enqueue, no SMS", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "   ",
      nowMs: NOW,
    });
    expect(out.decision).toBe("reject-empty-body");
    expect(out.enqueue).toBe(false);
    expect(out.outbound).toEqual([]);
  });

  it("non-string body → reject-non-string-body", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: undefined as unknown as string,
      nowMs: NOW,
    });
    expect(out.decision).toBe("reject-non-string-body");
    expect(out.enqueue).toBe(false);
  });

  it("wrong kind (assignment) at this orchestrator → reject-not-schedule-kind", () => {
    const out = planScheduleChangeFlow({
      kind: "assignment",
      body: "Can I do extra spelling?",
      nowMs: NOW,
    });
    expect(out.decision).toBe("reject-not-schedule-kind");
    expect(out.enqueue).toBe(false);
  });

  it("re-submit within 1h while pending → replace-superseded (still enqueue)", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move art instead, please",
      nowMs: NOW,
      pending: {
        submittedAtMs: NOW - 30 * 60 * 1000, // 30 min ago
        state: { mom: "pending", grandma: "pending" },
      },
    });
    expect(out.decision).toBe("replace-superseded");
    expect(out.enqueue).toBe(true);
    expect(out.outbound.length).toBeGreaterThan(0);
  });

  it("re-submit after 1h while still pending → reject-already-pending-from-reagan, no SMS", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move art to morning",
      nowMs: NOW,
      pending: {
        submittedAtMs: NOW - 90 * 60 * 1000, // 90 min ago
        state: { mom: "pending", grandma: "pending" },
      },
    });
    expect(out.decision).toBe("reject-already-pending-from-reagan");
    expect(out.enqueue).toBe(false);
    expect(out.outbound).toEqual([]);
  });

  it("re-submit when previous applied (both approved) → submit-fresh", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move recess earlier",
      nowMs: NOW,
      pending: {
        submittedAtMs: NOW - 5 * 60 * 60 * 1000,
        state: { mom: "approved", grandma: "approved" },
      },
    });
    expect(out.decision).toBe("submit-fresh");
    expect(out.enqueue).toBe(true);
  });

  it("re-submit when previous rejected → submit-fresh", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move recess earlier",
      nowMs: NOW,
      pending: {
        submittedAtMs: NOW - 60 * 60 * 1000,
        state: { mom: "rejected", grandma: "pending" },
      },
    });
    expect(out.decision).toBe("submit-fresh");
    expect(out.enqueue).toBe(true);
  });

  it("custom recipients override defaults (e.g. Dad off, Grandma swapped)", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move math",
      nowMs: NOW,
      recipients: {
        mom: "newmom@x.com",
        grandma: "newgrandma@x.com",
        dad: null,
      },
    });
    const emails = out.outbound.map((o) => o.toEmail);
    expect(emails).toContain("newmom@x.com");
    expect(emails).toContain("newgrandma@x.com");
    expect(emails).not.toContain("blakehiggs@hotmail.com");
  });

  it("rejected re-submit (already-pending) keeps adult banner showing prior state", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "Move math",
      nowMs: NOW,
      pending: {
        submittedAtMs: NOW - 90 * 60 * 1000,
        state: { mom: "approved", grandma: "pending" },
      },
    });
    // Decision rejects but the prior pending banner is still shown so
    // Reagan doesn't think nothing happened.
    expect(out.adultBanner.shouldShow).toBe(true);
    expect(out.adultBanner.outcome).toBe("pending-grandma");
  });

  it("urgent keyword in body propagates through routing.urgent", () => {
    const out = planScheduleChangeFlow({
      kind: "schedule-change",
      body: "I'm scared today, please move things",
      nowMs: NOW,
    });
    expect(out.routing.urgent).toBe(true);
  });
});
