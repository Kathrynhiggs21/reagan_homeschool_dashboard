import { describe, it, expect } from "vitest";
import {
  decideNotifyOwnerThrottle,
  __FOR_TEST__,
  type NotifyAttempt,
  type NotifyCategory,
} from "./_lib/notifyOwnerThrottle";

function a(
  category: NotifyCategory,
  iso: string,
  wasFired: boolean,
  kidEmail: string | null = null,
): NotifyAttempt {
  return { category, isoTimestamp: iso, wasFired, kidEmail };
}

describe("Push 195 — notifyOwnerThrottle", () => {
  it("empty attempts ⇒ no fire, reason 'no attempts'", () => {
    const r = decideNotifyOwnerThrottle({ attempts: [], nowIso: "2026-05-14T20:00:00Z" });
    expect(r.shouldFire).toBe(false);
    expect(r.suppressedReason).toBe("no attempts");
  });

  it("single pending in empty history ⇒ FIRE", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [a("vault_rotation_due", "2026-05-14T20:00:00Z", false)],
      nowIso: "2026-05-14T20:00:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("3 fired + 1 pending in window (cap=4) ⇒ FIRE", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:15:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:30:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:45:00Z", false, "reaganhiggs910@gmail.com"),
      ],
      nowIso: "2026-05-14T19:45:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("4 fired + 1 pending in window (cap=4) ⇒ SUPPRESS", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:15:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:30:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:45:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:50:00Z", false, "reaganhiggs910@gmail.com"),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(r.shouldFire).toBe(false);
    expect(r.suppressedReason).toContain("kid_login_help cap reached");
    expect(r.suppressedReason).toContain("4/4");
  });

  it("older fires outside the window do NOT count toward cap", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T17:00:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T17:30:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:30:00Z", true, "reaganhiggs910@gmail.com"),
        a("kid_login_help", "2026-05-14T19:45:00Z", false, "reaganhiggs910@gmail.com"),
      ],
      nowIso: "2026-05-14T19:45:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("different categories never share the cap", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true),
        a("kid_login_help", "2026-05-14T19:15:00Z", true),
        a("kid_login_help", "2026-05-14T19:30:00Z", true),
        a("kid_login_help", "2026-05-14T19:45:00Z", true),
        a("vault_rotation_due", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("non-fired earlier attempts do NOT count", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("vault_rotation_due", "2026-05-14T19:00:00Z", false),
        a("vault_rotation_due", "2026-05-14T19:15:00Z", false),
        a("vault_rotation_due", "2026-05-14T19:30:00Z", false),
        a("vault_rotation_due", "2026-05-14T19:45:00Z", false),
        a("vault_rotation_due", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("system_health bypass — never throttled even at cap", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("system_health", "2026-05-14T19:00:00Z", true),
        a("system_health", "2026-05-14T19:15:00Z", true),
        a("system_health", "2026-05-14T19:30:00Z", true),
        a("system_health", "2026-05-14T19:45:00Z", true),
        a("system_health", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("kid_login_help + IHSD-blocked email bypass — never throttled", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true, "reagan.higgs33@ihsd.us"),
        a("kid_login_help", "2026-05-14T19:15:00Z", true, "reagan.higgs33@ihsd.us"),
        a("kid_login_help", "2026-05-14T19:30:00Z", true, "reagan.higgs33@ihsd.us"),
        a("kid_login_help", "2026-05-14T19:45:00Z", true, "reagan.higgs33@ihsd.us"),
        a("kid_login_help", "2026-05-14T19:50:00Z", false, "reagan.higgs33@ihsd.us"),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("custom cap=2 trips earlier", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("weekly_digest", "2026-05-14T19:00:00Z", true),
        a("weekly_digest", "2026-05-14T19:15:00Z", true),
        a("weekly_digest", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
      perCategoryCap: 2,
    });
    expect(r.shouldFire).toBe(false);
    expect(r.suppressedReason).toContain("2/2");
  });

  it("custom windowMs=10min ignores older fires", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("weekly_digest", "2026-05-14T19:00:00Z", true),
        a("weekly_digest", "2026-05-14T19:15:00Z", true),
        a("weekly_digest", "2026-05-14T19:30:00Z", true),
        a("weekly_digest", "2026-05-14T19:45:00Z", true),
        a("weekly_digest", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
      windowMs: 10 * 60 * 1000,
    });
    expect(r.shouldFire).toBe(true);
  });

  it("bad nowIso defensive ⇒ FIRE rather than mute", () => {
    const r = decideNotifyOwnerThrottle({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true),
        a("kid_login_help", "2026-05-14T19:15:00Z", true),
        a("kid_login_help", "2026-05-14T19:30:00Z", true),
        a("kid_login_help", "2026-05-14T19:45:00Z", true),
        a("kid_login_help", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "not-a-real-date",
    });
    expect(r.shouldFire).toBe(true);
  });

  it("constants pin to spec", () => {
    expect(__FOR_TEST__.DEFAULT_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(__FOR_TEST__.DEFAULT_CAP).toBe(4);
    expect(__FOR_TEST__.BLOCKED_KID_EMAIL).toBe("reagan.higgs33@ihsd.us");
  });

  it("isBypass: system_health + IHSD kid_login_help yes; everything else no", () => {
    expect(__FOR_TEST__.isBypass(a("system_health", "2026-05-14T20:00:00Z", false))).toBe(true);
    expect(
      __FOR_TEST__.isBypass(a("kid_login_help", "2026-05-14T20:00:00Z", false, "reagan.higgs33@ihsd.us")),
    ).toBe(true);
    expect(
      __FOR_TEST__.isBypass(a("kid_login_help", "2026-05-14T20:00:00Z", false, "reaganhiggs910@gmail.com")),
    ).toBe(false);
    expect(__FOR_TEST__.isBypass(a("vault_rotation_due", "2026-05-14T20:00:00Z", false))).toBe(false);
    expect(__FOR_TEST__.isBypass(a("weekly_digest", "2026-05-14T20:00:00Z", false))).toBe(false);
    expect(__FOR_TEST__.isBypass(a("screen_time_overage", "2026-05-14T20:00:00Z", false))).toBe(false);
    expect(__FOR_TEST__.isBypass(a("other", "2026-05-14T20:00:00Z", false))).toBe(false);
  });

  it("deterministic — same input ⇒ same output", () => {
    const make = () => ({
      attempts: [
        a("kid_login_help", "2026-05-14T19:00:00Z", true),
        a("kid_login_help", "2026-05-14T19:50:00Z", false),
      ],
      nowIso: "2026-05-14T19:50:01Z",
    });
    expect(decideNotifyOwnerThrottle(make())).toEqual(decideNotifyOwnerThrottle(make()));
  });
});
