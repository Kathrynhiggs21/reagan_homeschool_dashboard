/**
 * Push 113 (2026-05-13) — Schedule-change pending banner contract.
 */
import { describe, it, expect } from "vitest";
import { planScheduleChangePendingBanner } from "./_lib/scheduleChangePendingBanner";

describe("Push 113 — Schedule-change pending banner", () => {
  it("self-hides when no change is active", () => {
    const r = planScheduleChangePendingBanner({
      active: false,
      audience: "reagan",
    });
    expect(r.shouldShow).toBe(false);
    expect(r.text).toBe("");
  });

  it("self-hides when state is missing even if active=true", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "reagan",
    });
    expect(r.shouldShow).toBe(false);
  });

  it("Mom approved + Grandma pending → mom audience sees 'no waiting on me' style; grandma sees waiting-on-grandma", () => {
    const grandma = planScheduleChangePendingBanner({
      active: true,
      audience: "grandma",
      state: { mom: "approved", grandma: "pending" },
    });
    expect(grandma.outcome).toBe("pending-grandma");
    expect(grandma.text).toMatch(/waiting on Grandma/);
    expect(grandma.tone).toBe("warn");
  });

  it("Mom pending + Grandma approved → adult banner = waiting-on-Mom", () => {
    const mom = planScheduleChangePendingBanner({
      active: true,
      audience: "mom",
      state: { mom: "pending", grandma: "approved" },
    });
    expect(mom.outcome).toBe("pending-mom");
    expect(mom.text).toMatch(/waiting on Mom/);
  });

  it("both pending → adult sees Mom + Grandma combined", () => {
    const both = planScheduleChangePendingBanner({
      active: true,
      audience: "viewer",
      state: { mom: "pending", grandma: "pending" },
    });
    expect(both.outcome).toBe("pending-both");
    expect(both.text).toMatch(/Mom \+ Grandma/);
  });

  it("Reagan never sees approver names while pending — kid-safe wording", () => {
    for (const variant of [
      { mom: "pending", grandma: "pending" },
      { mom: "approved", grandma: "pending" },
      { mom: "pending", grandma: "approved" },
    ] as const) {
      const r = planScheduleChangePendingBanner({
        active: true,
        audience: "reagan",
        state: variant,
      });
      expect(r.kidSafe).toBe(true);
      expect(r.text.toLowerCase()).not.toMatch(/mom|grandma/);
    }
  });

  it("both approved → applied, success tone", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "mom",
      state: { mom: "approved", grandma: "approved" },
    });
    expect(r.outcome).toBe("applied");
    expect(r.tone).toBe("success");
  });

  it("Mom rejected → rejected-by-mom, danger tone, adult names Mom", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "grandma",
      state: { mom: "rejected", grandma: "pending" },
    });
    expect(r.outcome).toBe("rejected-by-mom");
    expect(r.tone).toBe("danger");
    expect(r.text).toMatch(/rejected by Mom/);
  });

  it("Grandma rejected → rejected-by-grandma", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "mom",
      state: { mom: "pending", grandma: "rejected" },
    });
    expect(r.outcome).toBe("rejected-by-grandma");
    expect(r.text).toMatch(/rejected by Grandma/);
  });

  it("both rejected → rejected-by-both", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "viewer",
      state: { mom: "rejected", grandma: "rejected" },
    });
    expect(r.outcome).toBe("rejected-by-both");
    expect(r.text).toMatch(/both/i);
  });

  it("Reagan rejected wording is kid-safe and offers a path forward", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "reagan",
      state: { mom: "rejected", grandma: "approved" },
    });
    expect(r.kidSafe).toBe(true);
    expect(r.text.toLowerCase()).not.toMatch(/^.*rejected by/);
    expect(r.text.toLowerCase()).toMatch(/talk to mom|ask again|stays as-is/);
  });

  it("malformed state values fall through to no-change-active", () => {
    const r = planScheduleChangePendingBanner({
      active: true,
      audience: "viewer",
      state: { mom: "weird" as any, grandma: "weirder" as any },
    });
    expect(r.outcome).toBe("no-change-active");
    expect(r.shouldShow).toBe(false);
  });
});
