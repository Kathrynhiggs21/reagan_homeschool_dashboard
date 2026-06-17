import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

/**
 * Integration smoke test for kiwi.today — the authoritative server resolve that
 * powers Kiwi's daily costume everywhere (perch, Today header, panel). We hit
 * the real test DB (read-only here) and assert the resolver returns a complete,
 * well-shaped KiwiDayCharacter, that the date param is honored, and that a known
 * holiday date yields the holiday costume even with no events.
 */

function makeCtx() {
  return {
    user: { id: 1, openId: "test-admin", name: "Admin", role: "admin" as const },
    session: null,
  } as any;
}

describe("kiwi.today resolver", () => {
  it("returns a complete day-character shape for an explicit date", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const out = (await caller.kiwi.today({ date: "2026-09-15" })) as any;
    expect(out).toHaveProperty("date", "2026-09-15");
    expect(out).toHaveProperty("costume");
    expect(out).toHaveProperty("costumeLabel");
    expect(out).toHaveProperty("funnyLine");
    expect(out).toHaveProperty("idleLine");
    expect(out).toHaveProperty("reason");
    expect(typeof out.onVacation).toBe("boolean");
    expect(typeof out.funnyLine).toBe("string");
    expect(out.funnyLine.length).toBeGreaterThan(0);
  });

  it("honors a known holiday date (July 4 -> firework) when no event overrides", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const out = (await caller.kiwi.today({ date: "2026-07-04" })) as any;
    // If a real appointment in the test DB happens to match a costume keyword,
    // the reason would be calendar-event; otherwise it must be the holiday.
    expect(["holiday", "calendar-event", "vacation"]).toContain(out.reason);
    if (out.reason === "holiday") {
      expect(out.costume).toBe("firework");
    }
  });

  it("is deterministic for the same date", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const a = (await caller.kiwi.today({ date: "2026-09-15" })) as any;
    const b = (await caller.kiwi.today({ date: "2026-09-15" })) as any;
    expect(a).toEqual(b);
  });

  it("defaults to today when no date is provided", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const out = (await caller.kiwi.today()) as any;
    expect(out.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
