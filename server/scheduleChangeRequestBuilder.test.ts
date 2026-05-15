import { describe, it, expect } from "vitest";
import { buildScheduleChangeRequest } from "./_lib/scheduleChangeRequestBuilder";

const ISO = "2026-05-15";

describe("scheduleChangeRequestBuilder — house rules", () => {
  it("hard-blocks reagan.higgs33@ihsd.us (IHSD school email)", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockTitles: ["Math", "Writing"] },
      fromAccount: "reagan.higgs33@ihsd.us",
    });
    expect(r.blocked).toBe(true);
    expect(r.blockedReason).toContain("reagan.higgs33@ihsd.us");
    expect(r.approvers).toHaveLength(0);
    expect(r.requestId).toBe("");
  });

  it("hard-blocks IHSD email regardless of case", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap" },
      fromAccount: "Reagan.Higgs33@IHSD.US",
    });
    expect(r.blocked).toBe(true);
  });

  it("always requires BOTH mom and grandma to approve", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockTitles: ["Math", "Writing"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.blocked).toBe(false);
    expect(r.approvers).toHaveLength(2);
    const roles = r.approvers.map((a) => a.role).sort();
    expect(roles).toEqual(["grandma", "mom"]);
    const emails = r.approvers.map((a) => a.email).sort();
    expect(emails).toContain("marcy.spear@gmail.com");
    expect(emails).toContain("spear.cpt@gmail.com");
    expect(r.approvers.every((a) => a.status === "pending")).toBe(true);
  });

  it("kidConfirmLine never says it's done — only sent for approval", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap" },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.kidConfirmLine.toLowerCase()).toMatch(/sent|both|ok/);
    expect(r.kidConfirmLine.toLowerCase()).not.toMatch(/done|changed|updated/);
  });

  it("kidConfirmLine + adultBodyLine never contain forbidden voice words", () => {
    const forbidden = /buddy|friend|yay|woohoo|great job|awesome/i;
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "move_earlier", targetBlockTitles: ["Adventure"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.kidConfirmLine).not.toMatch(forbidden);
    expect(r.adultBodyLine).not.toMatch(forbidden);
  });

  it("adultBodyLine includes the action phrase and target", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockTitles: ["Math", "Writing"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.adultBodyLine.toLowerCase()).toContain("swap");
    expect(r.adultBodyLine).toContain("Math + Writing");
  });

  it("adultBodyLine includes reasonFromKid when provided", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: {
        action: "skip_block",
        targetBlockTitles: ["Writing"],
        reasonFromKid: "wrist hurts",
      },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.adultBodyLine.toLowerCase()).toContain("wrist hurts");
  });

  it("adultBodyLine never blames Reagan even when reason is missing", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "skip_block", targetBlockTitles: ["Writing"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.adultBodyLine.toLowerCase()).not.toMatch(/trying to skip|wants out|lazy|refuses/);
  });

  it("includes proposedTitle and proposedSubjectSlug in adultBodyLine when given", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: {
        action: "replace_block",
        targetBlockTitles: ["Writing"],
        proposedTitle: "Art journaling",
        proposedSubjectSlug: "art",
      },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.adultBodyLine).toContain("Art journaling");
    expect(r.adultBodyLine).toContain("(art)");
  });

  it("requestId is deterministic for same input", () => {
    const args = {
      isoDate: ISO,
      intent: {
        action: "swap" as const,
        targetBlockTitles: ["Math", "Writing"],
        proposedTitle: "",
      },
      fromAccount: "reaganhiggs910@gmail.com",
    };
    const a = buildScheduleChangeRequest(args);
    const b = buildScheduleChangeRequest(args);
    expect(a.requestId).toBe(b.requestId);
    expect(a.requestId).toMatch(/^req_2026-05-15_swap_/);
  });

  it("requestId differs when action or targets differ", () => {
    const swap = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockTitles: ["Math", "Writing"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    const skip = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "skip_block", targetBlockTitles: ["Math"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(swap.requestId).not.toBe(skip.requestId);
  });

  it("handles unknown action with a generic update phrase", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "unknown" },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.adultBodyLine.toLowerCase()).toContain("update");
  });

  it("trims empty target titles", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockTitles: ["", " ", "Math"] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.targetBlockTitles).toEqual(["Math"]);
  });

  it("preserves targetBlockIds verbatim", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap", targetBlockIds: [11, 12] },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.targetBlockIds).toEqual([11, 12]);
  });

  it("propagates the isoDate into both the result and the requestId", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap" },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.isoDate).toBe(ISO);
    expect(r.requestId).toContain(ISO);
  });

  it("returns null for proposed fields when not provided", () => {
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap" },
      fromAccount: "reaganhiggs910@gmail.com",
    });
    expect(r.proposedTitle).toBeNull();
    expect(r.proposedSubjectSlug).toBeNull();
    expect(r.reasonFromKid).toBeNull();
  });

  it("from a Mom-Pear-Classes account (spear.cpt@gmail.com) still produces a normal request", () => {
    // Adults can also use the helper if they want to submit a request
    // — the blocked branch is ONLY for the IHSD school email.
    const r = buildScheduleChangeRequest({
      isoDate: ISO,
      intent: { action: "swap" },
      fromAccount: "spear.cpt@gmail.com",
    });
    expect(r.blocked).toBe(false);
    expect(r.approvers).toHaveLength(2);
  });
});
