/**
 * Push 122 (2026-05-13) — Kid-facing 5-minute reset countdown contract.
 */
import { describe, it, expect } from "vitest";
import {
  computeKidResetState,
  KID_RESET_DEFAULT_MS,
} from "./_lib/kidResetCountdown";

const NOW = 1_780_000_000_000; // arbitrary fixed clock

describe("Push 122 — computeKidResetState", () => {
  it("idle when startedAtMs is null/undefined/non-finite", () => {
    for (const startedAtMs of [null, undefined, NaN, Infinity, -Infinity]) {
      const out = computeKidResetState({
        startedAtMs: startedAtMs as any,
        nowMs: NOW,
      });
      expect(out.phase).toBe("idle");
      expect(out.remainingLabel).toBe("00:00");
      expect(out.progress).toBe(0);
    }
  });

  it("idle when startedAtMs is in the future", () => {
    const out = computeKidResetState({
      startedAtMs: NOW + 60_000,
      nowMs: NOW,
    });
    expect(out.phase).toBe("idle");
  });

  it("running shows decreasing remainingLabel and progress in [0,1)", () => {
    // 30s in
    const out = computeKidResetState({
      startedAtMs: NOW - 30_000,
      nowMs: NOW,
    });
    expect(out.phase).toBe("running");
    expect(out.elapsedMs).toBe(30_000);
    expect(out.remainingMs).toBe(KID_RESET_DEFAULT_MS - 30_000);
    expect(out.remainingLabel).toBe("04:30");
    expect(out.progress).toBeGreaterThan(0);
    expect(out.progress).toBeLessThan(1);
  });

  it("uses calm Kiwi copy in the first 60%", () => {
    const out = computeKidResetState({
      startedAtMs: NOW - 60_000, // 1 min in of 5
      nowMs: NOW,
    });
    expect(out.kiwiCopy).toMatch(/take a beat/i);
  });

  it("flips to mid Kiwi copy at/after the 60% mark", () => {
    const out = computeKidResetState({
      startedAtMs: NOW - 200_000, // 200s of 300s = 66%
      nowMs: NOW,
    });
    expect(out.kiwiCopy).toMatch(/almost there|slow breaths/i);
  });

  it("flips to finished exactly at duration and stays there", () => {
    const exactly = computeKidResetState({
      startedAtMs: NOW - KID_RESET_DEFAULT_MS,
      nowMs: NOW,
    });
    expect(exactly.phase).toBe("finished");
    expect(exactly.remainingLabel).toBe("00:00");
    expect(exactly.progress).toBe(1);

    const wayPast = computeKidResetState({
      startedAtMs: NOW - 10 * KID_RESET_DEFAULT_MS,
      nowMs: NOW,
    });
    expect(wayPast.phase).toBe("finished");
    expect(wayPast.elapsedMs).toBe(KID_RESET_DEFAULT_MS); // capped
  });

  it("respects custom durationMs override", () => {
    const out = computeKidResetState({
      startedAtMs: NOW - 30_000,
      nowMs: NOW,
      durationMs: 60_000,
    });
    expect(out.phase).toBe("running");
    expect(out.remainingLabel).toBe("00:30");
  });

  it("non-positive or non-finite durationMs falls back to default", () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      const out = computeKidResetState({
        startedAtMs: NOW - 30_000,
        nowMs: NOW,
        durationMs: bad,
      });
      expect(out.phase).toBe("running");
      expect(out.remainingLabel).toBe("04:30");
    }
  });

  it("adult copy stays in sync with phase", () => {
    expect(
      computeKidResetState({ startedAtMs: null, nowMs: NOW }).adultCopy,
    ).toMatch(/no reset/i);
    expect(
      computeKidResetState({ startedAtMs: NOW - 60_000, nowMs: NOW }).adultCopy,
    ).toMatch(/in progress/i);
    expect(
      computeKidResetState({
        startedAtMs: NOW - KID_RESET_DEFAULT_MS,
        nowMs: NOW,
      }).adultCopy,
    ).toMatch(/finished/i);
  });

  it("never blames Reagan in any kid-facing copy", () => {
    const idle = computeKidResetState({ startedAtMs: null, nowMs: NOW });
    const running = computeKidResetState({
      startedAtMs: NOW - 60_000,
      nowMs: NOW,
    });
    const finished = computeKidResetState({
      startedAtMs: NOW - KID_RESET_DEFAULT_MS,
      nowMs: NOW,
    });
    for (const c of [idle.kiwiCopy, running.kiwiCopy, finished.kiwiCopy]) {
      expect(c).not.toMatch(/bad|wrong|stop|misbeha|fault|crisis|red zone/i);
    }
  });
});
