import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  planSundayDigestSend,
  dedupePlannedSends,
  type QueuedDigestSend,
} from "./_lib/sundayDigestSendQueue";
import { renderSundayDigestHtml } from "./_lib/sundayDigestRenderer";
import { setGrandmaEmailPaused } from "./_lib/grandmaAudience";

describe("Push 78 — Sunday digest send queue", () => {
  // These cases verify the recipient-ORDERING contract, which only includes
  // Grandma when she is NOT paused. The global pause (default ON as of
  // 2026-06-18) is exercised separately below.
  beforeEach(() => setGrandmaEmailPaused(false));
  afterEach(() => setGrandmaEmailPaused(false));

  it("always queues Mom first, Grandma second", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
    });
    expect(plan).toHaveLength(2);
    expect(plan[0].recipient.role).toBe("mom");
    expect(plan[1].recipient.role).toBe("grandma");
  });

  it("idempotency key is weekStart:lowercased-email", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
    });
    expect(plan[0].idempotencyKey).toBe(
      "2026-05-10:reaganhiggs910@gmail.com",
    );
    expect(plan[1].idempotencyKey).toBe(
      "2026-05-10:marcy.spear@gmail.com",
    );
  });

  it("extra recipients append AFTER Mom + Grandma without re-ordering", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
      extraRecipients: [
        { email: "dad@example.com", displayName: "Dad", role: "family-admin" },
      ],
    });
    expect(plan).toHaveLength(3);
    expect(plan[0].recipient.role).toBe("mom");
    expect(plan[1].recipient.role).toBe("grandma");
    expect(plan[2].recipient.email).toBe("dad@example.com");
  });

  it("de-duplicates if an extra recipient shadows the base set (e.g. mom email duplicated)", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
      extraRecipients: [
        {
          email: "ReaganHiggs910@gmail.com",
          displayName: "Mom dup",
          role: "family-admin",
        },
      ],
    });
    expect(plan).toHaveLength(2);
    // Mom retains her base role, not the family-admin override.
    expect(plan[0].recipient.role).toBe("mom");
  });

  it("dedupePlannedSends filters out already-queued idempotency keys", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
    });
    const fresh = dedupePlannedSends(plan, [
      "2026-05-10:reaganhiggs910@gmail.com",
    ]);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].recipient.role).toBe("grandma");
  });

  it("custom baseRecipients override (different household configuration)", () => {
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
      baseRecipients: [
        { email: "guardian@example.com", displayName: "Guardian", role: "family-admin" },
      ],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].recipient.email).toBe("guardian@example.com");
  });

  it("renderer footer surfaces 'Mom + Grandma recipients' phrasing for the queued body", () => {
    const html = renderSundayDigestHtml(
      {
        weekStart: "2026-05-10",
        weekEnd: "2026-05-16",
        generatedAt: "2026-05-13",
      },
      { recipients: ["reaganhiggs910@gmail.com", "marcy.spear@gmail.com"] },
    );
    expect(html).toContain("Mom + Grandma recipients");
    expect(html).toContain("reaganhiggs910@gmail.com");
    expect(html).toContain("marcy.spear@gmail.com");
  });

  it("2026-06-18 PAUSE: Grandma is dropped from the queued send while paused", () => {
    setGrandmaEmailPaused(true);
    const plan = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].recipient.role).toBe("mom");
    expect(plan.some((p) => p.recipient.email === "marcy.spear@gmail.com")).toBe(false);
  });

  it("idempotency keys are unique within a single plan", () => {
    const plan: QueuedDigestSend[] = planSundayDigestSend({
      weekStart: "2026-05-10",
      weekEnd: "2026-05-16",
      extraRecipients: [
        { email: "tutor@example.com", displayName: "Tutor", role: "family-admin" },
      ],
    });
    const keys = plan.map((p) => p.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
