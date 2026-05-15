import { describe, it, expect } from "vitest";
import {
  decideKidLoginCooldown,
  __FOR_TEST__,
  type KidLoginEvent,
  type Symptom,
} from "./_lib/kidLoginCooldown";

function ev(
  appKey: string,
  symptom: Symptom,
  iso: string,
  escalate: boolean,
  kidEmail: string | null = "reaganhiggs910@gmail.com",
): KidLoginEvent {
  return { appKey, symptom, isoTimestamp: iso, escalateToGrownup: escalate, kidEmail };
}

describe("Push 194 — kidLoginCooldown", () => {
  it("empty events ⇒ no notify, reason 'no events'", () => {
    const r = decideKidLoginCooldown({ events: [], nowIso: "2026-05-14T20:00:00Z" });
    expect(r.shouldFireNotify).toBe(false);
    expect(r.suppressedReason).toBe("no events");
  });

  it("latest event not escalating ⇒ no notify", () => {
    const r = decideKidLoginCooldown({
      events: [ev("khan", "page won't load", "2026-05-14T20:00:00Z", false)],
      nowIso: "2026-05-14T20:00:01Z",
    });
    expect(r.shouldFireNotify).toBe(false);
    expect(r.suppressedReason).toContain("not escalating");
  });

  it("single escalating event ⇒ FIRE", () => {
    const r = decideKidLoginCooldown({
      events: [ev("khan", "wrong password", "2026-05-14T20:00:00Z", true)],
      nowIso: "2026-05-14T20:00:01Z",
    });
    expect(r.shouldFireNotify).toBe(true);
    expect(r.suppressedReason).toBeNull();
  });

  it("two same-app escalations within 15 min ⇒ SUPPRESS the second", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:05:00Z", true),
      ],
      nowIso: "2026-05-14T20:05:00Z",
    });
    expect(r.shouldFireNotify).toBe(false);
    expect(r.suppressedReason).toContain("already pinged");
    expect(r.suppressedReason).toContain("khan");
    expect(r.suppressedReason).toContain("5 min ago");
  });

  it("two same-app escalations 16 min apart ⇒ FIRE the second", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:16:00Z", true),
      ],
      nowIso: "2026-05-14T20:16:00Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("different appKeys never share cooldown", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("ixl", "wrong password", "2026-05-14T20:01:00Z", true),
      ],
      nowIso: "2026-05-14T20:01:00Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("symptom 'asks for grown-up' ALWAYS passes through (safety)", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "asks for grown-up", "2026-05-14T20:00:00Z", true),
        ev("khan", "asks for grown-up", "2026-05-14T20:00:30Z", true),
      ],
      nowIso: "2026-05-14T20:00:30Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("symptom \"says I'm not allowed\" ALWAYS passes through (safety)", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "says I'm not allowed", "2026-05-14T20:00:00Z", true),
        ev("khan", "says I'm not allowed", "2026-05-14T20:00:30Z", true),
      ],
      nowIso: "2026-05-14T20:00:30Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("blocked IHSD kidEmail ALWAYS passes through (safety)", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true, "reagan.higgs33@ihsd.us"),
        ev("khan", "wrong password", "2026-05-14T20:00:30Z", true, "reagan.higgs33@ihsd.us"),
      ],
      nowIso: "2026-05-14T20:00:30Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("custom cooldownMs is honored (5 min)", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:04:00Z", true),
      ],
      nowIso: "2026-05-14T20:04:00Z",
      cooldownMs: 5 * 60 * 1000,
    });
    expect(r.shouldFireNotify).toBe(false);
  });

  it("custom cooldownMs allows pass-through past window", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:05:00Z", true),
      ],
      nowIso: "2026-05-14T20:05:00Z",
      cooldownMs: 5 * 60 * 1000,
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("non-escalating earlier event does NOT trip cooldown", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "page won't load", "2026-05-14T20:00:00Z", false),
        ev("khan", "wrong password", "2026-05-14T20:05:00Z", true),
      ],
      nowIso: "2026-05-14T20:05:00Z",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("ignores older same-app escalation outside window when newer in-window exists", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T19:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T19:50:00Z", true),
        ev("khan", "wrong password", "2026-05-14T19:55:00Z", true),
      ],
      nowIso: "2026-05-14T19:55:00Z",
    });
    expect(r.shouldFireNotify).toBe(false);
    expect(r.suppressedReason).toContain("5 min ago");
  });

  it("bad nowIso defensive ⇒ FIRE rather than mute", () => {
    const r = decideKidLoginCooldown({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:05:00Z", true),
      ],
      nowIso: "not-a-real-date",
    });
    expect(r.shouldFireNotify).toBe(true);
  });

  it("constants pin to spec (15 min default + IHSD email)", () => {
    expect(__FOR_TEST__.DEFAULT_COOLDOWN_MS).toBe(15 * 60 * 1000);
    expect(__FOR_TEST__.BLOCKED_KID_EMAIL).toBe("reagan.higgs33@ihsd.us");
    expect(__FOR_TEST__.ALWAYS_THROUGH_SYMPTOMS).toContain("asks for grown-up");
    expect(__FOR_TEST__.ALWAYS_THROUGH_SYMPTOMS).toContain("says I'm not allowed");
  });

  it("isAlwaysThrough covers symptom + email cases", () => {
    expect(
      __FOR_TEST__.isAlwaysThrough(
        ev("k", "asks for grown-up", "2026-05-14T20:00:00Z", true),
      ),
    ).toBe(true);
    expect(
      __FOR_TEST__.isAlwaysThrough(
        ev("k", "wrong password", "2026-05-14T20:00:00Z", true, "reagan.higgs33@ihsd.us"),
      ),
    ).toBe(true);
    expect(
      __FOR_TEST__.isAlwaysThrough(
        ev("k", "wrong password", "2026-05-14T20:00:00Z", true, "reaganhiggs910@gmail.com"),
      ),
    ).toBe(false);
  });

  it("deterministic — same input ⇒ same output", () => {
    const make = () => ({
      events: [
        ev("khan", "wrong password", "2026-05-14T20:00:00Z", true),
        ev("khan", "wrong password", "2026-05-14T20:05:00Z", true),
      ],
      nowIso: "2026-05-14T20:05:00Z",
    });
    expect(decideKidLoginCooldown(make())).toEqual(decideKidLoginCooldown(make()));
  });
});
