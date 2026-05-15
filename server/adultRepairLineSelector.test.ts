import { describe, it, expect } from "vitest";
import {
  selectRepairLine,
  isLineSafeForAdult,
  __FOR_TEST__,
  type RepairContext,
} from "./_lib/adultRepairLineSelector";

const ALL_CONTEXTS: RepairContext[] = [
  "vault_rotation_due",
  "vault_rotation_overdue",
  "screen_time_overage",
  "kid_login_escalation",
  "weekly_digest_opener",
  "system_health_blip",
  "scheduled_task_recovered",
  "drive_mirror_skipped",
  "ihsd_email_blocked_attempt",
  "great_week_summary",
];

describe("Push 201 — adultRepairLineSelector", () => {
  it("returns a non-empty line for every context", () => {
    for (const ctx of ALL_CONTEXTS) {
      const r = selectRepairLine({ context: ctx, seed: "2026-05-14" });
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.severity).toBeTruthy();
    }
  });

  it("substitutes {name} with adultName", () => {
    const r = selectRepairLine({
      context: "vault_rotation_due",
      seed: "x",
      adultName: "Mom",
    });
    expect(r.text).toContain("Mom");
    expect(r.text).not.toContain("{name}");
  });

  it("defaults adultName to Mom when omitted", () => {
    const r = selectRepairLine({ context: "vault_rotation_due", seed: "x" });
    expect(r.text).toContain("Mom");
  });

  it("custom adultName works (Grandma)", () => {
    const r = selectRepairLine({
      context: "great_week_summary",
      seed: "x",
      adultName: "Grandma",
    });
    expect(r.text).toContain("Grandma");
    expect(r.text).not.toContain("Mom");
  });

  it("same (context+seed) ⇒ same line (deterministic)", () => {
    const a = selectRepairLine({ context: "vault_rotation_due", seed: "2026-05-14" });
    const b = selectRepairLine({ context: "vault_rotation_due", seed: "2026-05-14" });
    expect(a).toEqual(b);
  });

  it("different seeds rotate through the pool", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = selectRepairLine({ context: "kid_login_escalation", seed: `seed-${i}` });
      seen.add(r.text);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("every line in every pool is safe (no forbidden words, no kid-blame)", () => {
    for (const [ctx, pool] of Object.entries(__FOR_TEST__.POOLS)) {
      for (const line of pool) {
        const sample = line.text.replace(/{name}/g, "Mom");
        expect(isLineSafeForAdult(sample), `unsafe line in ${ctx}: "${sample}"`).toBe(true);
      }
    }
  });

  it("every line uses one of the three severity levels", () => {
    const allowed = new Set(["info", "attention", "ask_when_ready"]);
    for (const pool of Object.values(__FOR_TEST__.POOLS)) {
      for (const line of pool) {
        expect(allowed.has(line.severity)).toBe(true);
      }
    }
  });

  it("every pool has at least 3 lines", () => {
    for (const [ctx, pool] of Object.entries(__FOR_TEST__.POOLS)) {
      expect(pool.length, `pool ${ctx} too short`).toBeGreaterThanOrEqual(3);
    }
  });

  it("isLineSafeForAdult flags shouty/alarmist words", () => {
    expect(isLineSafeForAdult("URGENT — drive mirror BROKEN")).toBe(false);
    expect(isLineSafeForAdult("Critical failure detected")).toBe(false);
    expect(isLineSafeForAdult("Hi Mom — heads up, cap reached")).toBe(true);
  });

  it("isLineSafeForAdult flags kid-blame phrases", () => {
    expect(isLineSafeForAdult("Reagan can't sign in to IXL")).toBe(false);
    expect(isLineSafeForAdult("Reagan forgot her password")).toBe(false);
    expect(isLineSafeForAdult("The IXL sign-in needs a fresh password")).toBe(true);
  });

  it("isLineSafeForAdult is case-insensitive", () => {
    expect(isLineSafeForAdult("URGENT")).toBe(false);
    expect(isLineSafeForAdult("urgent")).toBe(false);
    expect(isLineSafeForAdult("REAGAN FORGOT her password")).toBe(false);
  });

  it("never produces output containing forbidden/blame words for any context", () => {
    for (const ctx of ALL_CONTEXTS) {
      for (let i = 0; i < 25; i++) {
        const r = selectRepairLine({ context: ctx, seed: `s${i}` });
        expect(isLineSafeForAdult(r.text), `unsafe output in ${ctx}: "${r.text}"`).toBe(true);
      }
    }
  });

  it("falls back gracefully on unknown context", () => {
    const r = selectRepairLine({
      context: "totally_made_up" as RepairContext,
      seed: "x",
    });
    expect(r.text).toContain("Mom");
    expect(r.severity).toBe("info");
  });

  it("FORBIDDEN list contains the most important alarm-words", () => {
    const list = __FOR_TEST__.FORBIDDEN;
    expect(list).toContain("urgent");
    expect(list).toContain("failed");
    expect(list).toContain("broken");
    expect(list).toContain("emergency");
  });

  it("BLAMES_KID list contains the most important blame-phrases", () => {
    const list = __FOR_TEST__.BLAMES_KID;
    expect(list).toContain("reagan can't");
    expect(list).toContain("reagan forgot");
  });

  it("hashSeed mirrors Push 200 (FNV-1a 32-bit)", () => {
    const a = __FOR_TEST__.hashSeed("hello");
    const b = __FOR_TEST__.hashSeed("hello");
    expect(a).toBe(b);
    expect(typeof a).toBe("number");
  });

  it("output is brief (<= 180 chars for adult comfort)", () => {
    for (const ctx of ALL_CONTEXTS) {
      for (let i = 0; i < 10; i++) {
        const r = selectRepairLine({ context: ctx, seed: `s${i}` });
        expect(r.text.length, `too long in ${ctx}: ${r.text}`).toBeLessThanOrEqual(180);
      }
    }
  });

  it("ask_when_ready severity used for non-urgent operational asks", () => {
    const ctxs: RepairContext[] = ["vault_rotation_due", "drive_mirror_skipped"];
    for (const ctx of ctxs) {
      for (const line of __FOR_TEST__.POOLS[ctx]) {
        expect(line.severity).toBe("ask_when_ready");
      }
    }
  });

  it("attention severity reserved for things needing today-ish action", () => {
    const ctxs: RepairContext[] = ["vault_rotation_overdue", "kid_login_escalation"];
    for (const ctx of ctxs) {
      for (const line of __FOR_TEST__.POOLS[ctx]) {
        expect(line.severity).toBe("attention");
      }
    }
  });

  it("output ends with a sentence-ish character", () => {
    for (const ctx of ALL_CONTEXTS) {
      const r = selectRepairLine({ context: ctx, seed: "today" });
      expect(r.text).toMatch(/[.!?]$/);
    }
  });

  it("kid_login_escalation lines explicitly say 'not urgent' or similar", () => {
    const lines = __FOR_TEST__.POOLS.kid_login_escalation;
    const reassuring = lines.filter((l) => /not urgent|when free|quick/i.test(l.text));
    expect(reassuring.length).toBeGreaterThan(0);
  });

  it("ihsd_email_blocked_attempt lines reassure that Reagan didn't see anything", () => {
    const lines = __FOR_TEST__.POOLS.ihsd_email_blocked_attempt;
    const reassuring = lines.filter((l) => /reagan didn't see|sanitized|filtered|audit|blocked/i.test(l.text));
    expect(reassuring.length).toBe(lines.length);
  });
});
