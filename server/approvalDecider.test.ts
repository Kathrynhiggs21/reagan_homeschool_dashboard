import { describe, it, expect } from "vitest";
import { decideApproval } from "./_lib/approvalDecider";

describe("approvalDecider — Slice 3.5", () => {
  it("hard-blocks tutor_add (always escalates)", () => {
    const r = decideApproval({
      kind: "tutor_add",
      payload: { name: "Alice" },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
    expect(r.reason).toMatch(/hard rule/);
  });

  it("hard-blocks credential_add", () => {
    const r = decideApproval({
      kind: "credential_add",
      payload: {},
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("hard-blocks student_email_change", () => {
    const r = decideApproval({
      kind: "student_email_change",
      payload: {},
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("hard-blocks email_block_change", () => {
    const r = decideApproval({
      kind: "email_block_change",
      payload: {},
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("hard-blocks year_plan_target_change", () => {
    const r = decideApproval({
      kind: "year_plan_target_change",
      payload: {},
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("flags >3 same-kind requests in last hour", () => {
    const r = decideApproval({
      kind: "softenBlock",
      payload: {},
      requesterRole: "admin",
      recentSameKindCount: 4,
    });
    expect(r.decision).toBe("needs_review");
    expect(r.reason).toMatch(/last hour/);
  });

  it("escalates day_reset when submitted by Reagan herself", () => {
    const r = decideApproval({
      kind: "day_reset",
      payload: {},
      requesterRole: "student",
      localHour: 7,
      affectedDayHasCompletedBlock: false,
    });
    expect(r.decision).toBe("needs_review");
    expect(r.reason).toMatch(/Reagan/);
  });

  it("auto-approves coin_redemption ≤ 20", () => {
    const r = decideApproval({
      kind: "coin_redemption",
      payload: { amount: 15 },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("auto_approve");
  });

  it("escalates coin_redemption > 20", () => {
    const r = decideApproval({
      kind: "coin_redemption",
      payload: { amount: 50 },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("auto-approves day_reset before 9 AM with no completed work", () => {
    const r = decideApproval({
      kind: "day_reset",
      payload: {},
      requesterRole: "admin",
      localHour: 7,
      affectedDayHasCompletedBlock: false,
    });
    expect(r.decision).toBe("auto_approve");
  });

  it("escalates day_reset after 9 AM (adult)", () => {
    const r = decideApproval({
      kind: "day_reset",
      payload: {},
      requesterRole: "admin",
      localHour: 14,
      affectedDayHasCompletedBlock: false,
    });
    expect(r.decision).toBe("needs_review");
  });

  it("escalates day_reset that would discard completed blocks", () => {
    const r = decideApproval({
      kind: "day_reset",
      payload: {},
      requesterRole: "admin",
      localHour: 7,
      affectedDayHasCompletedBlock: true,
    });
    expect(r.decision).toBe("needs_review");
    expect(r.reason).toMatch(/discard/);
  });

  it("auto-approves summer_mode_early on/after Jun 1 with backbone ≥80%", () => {
    const r = decideApproval({
      kind: "summer_mode_early",
      payload: { dateIso: "2026-06-02" },
      requesterRole: "admin",
      yearPlanPercentComplete: 85,
    });
    expect(r.decision).toBe("auto_approve");
  });

  it("escalates summer_mode_early before Jun 1", () => {
    const r = decideApproval({
      kind: "summer_mode_early",
      payload: { dateIso: "2026-05-15" },
      requesterRole: "admin",
      yearPlanPercentComplete: 95,
    });
    expect(r.decision).toBe("needs_review");
  });

  it("escalates summer_mode_early when backbone < 80%", () => {
    const r = decideApproval({
      kind: "summer_mode_early",
      payload: { dateIso: "2026-06-15" },
      requesterRole: "admin",
      yearPlanPercentComplete: 50,
    });
    expect(r.decision).toBe("needs_review");
  });

  it("auto-approves vacation_off_range ≤ 7 days", () => {
    const r = decideApproval({
      kind: "vacation_off_range",
      payload: { consecutiveDays: 5 },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("auto_approve");
  });

  it("escalates vacation_off_range > 7 days", () => {
    const r = decideApproval({
      kind: "vacation_off_range",
      payload: { consecutiveDays: 10 },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("escalates ai_agenda_edit_large", () => {
    const r = decideApproval({
      kind: "ai_agenda_edit_large",
      payload: { blockCount: 5 },
      requesterRole: "admin",
    });
    expect(r.decision).toBe("needs_review");
  });

  it("default: auto-approves unknown routine kinds", () => {
    const r = decideApproval({
      kind: "swap_one_block",
      payload: {},
      requesterRole: "admin",
    });
    expect(r.decision).toBe("auto_approve");
  });
});
