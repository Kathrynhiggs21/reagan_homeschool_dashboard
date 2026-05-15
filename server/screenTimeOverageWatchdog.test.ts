import { describe, it, expect } from "vitest";
import {
  decideScreenTimeOverage,
  __FOR_TEST__,
  type WatchdogInput,
  type AppMinutesSample,
} from "./_lib/screenTimeOverageWatchdog";

const TODAY = "2026-05-14";

const ALWAYS_ALLOWED = [
  "khan_kids",
  "book_creator",
  "vocab_com",
  "code_org",
  "merlin",
  "inaturalist",
];

function s(appKey: string, minutes: number, name = appKey): AppMinutesSample {
  return { appKey, appName: name, minutes };
}

function input(over: Partial<WatchdogInput> = {}): WatchdogInput {
  return {
    todaySamples: [],
    capMinutes: 45,
    alwaysAllowedAppKeys: ALWAYS_ALLOWED,
    isoDateLocal: TODAY,
    history: [],
    ...over,
  };
}

describe("Push 197 — screenTimeOverageWatchdog", () => {
  it("under cap ⇒ no notify, suppressedReason='under cap'", () => {
    const r = decideScreenTimeOverage(
      input({ todaySamples: [s("prodigy", 20), s("blooket", 10)] }),
    );
    expect(r.shouldNotify).toBe(false);
    expect(r.tier).toBeNull();
    expect(r.suppressedReason).toBe("under cap");
    expect(r.countedMinutes).toBe(30);
  });

  it("at cap exactly ⇒ tier=cap_reached, fires", () => {
    const r = decideScreenTimeOverage(
      input({ todaySamples: [s("prodigy", 30), s("blooket", 15)] }),
    );
    expect(r.tier).toBe("cap_reached");
    expect(r.shouldNotify).toBe(true);
    expect(r.notifyPayload?.category).toBe("screen_time_overage");
  });

  it("+30 over cap ⇒ tier=plus_30", () => {
    const r = decideScreenTimeOverage(
      input({ todaySamples: [s("prodigy", 75)] }),
    );
    expect(r.tier).toBe("plus_30");
    expect(r.shouldNotify).toBe(true);
  });

  it("+60 over cap ⇒ tier=plus_60", () => {
    const r = decideScreenTimeOverage(
      input({ todaySamples: [s("prodigy", 110)] }),
    );
    expect(r.tier).toBe("plus_60");
    expect(r.shouldNotify).toBe(true);
  });

  it("always-allowed apps NEVER count toward cap", () => {
    const r = decideScreenTimeOverage(
      input({
        todaySamples: [
          s("khan_kids", 90),
          s("book_creator", 60),
          s("code_org", 45),
          s("prodigy", 20),
        ],
      }),
    );
    expect(r.countedMinutes).toBe(20);
    expect(r.tier).toBeNull();
    expect(r.shouldNotify).toBe(false);
  });

  it("same tier already fired today ⇒ suppress, kid+adult headlines still set", () => {
    const r = decideScreenTimeOverage(
      input({
        todaySamples: [s("prodigy", 50)],
        history: [{ isoDate: TODAY, tier: "cap_reached" }],
      }),
    );
    expect(r.tier).toBe("cap_reached");
    expect(r.shouldNotify).toBe(false);
    expect(r.suppressedReason).toContain("already notified");
    expect(r.kidHeadline).toMatch(/screen goal/i);
    expect(r.adultHeadline).toBeTruthy();
    expect(r.notifyPayload).toBeNull();
  });

  it("history for a different date does NOT suppress today", () => {
    const r = decideScreenTimeOverage(
      input({
        todaySamples: [s("prodigy", 50)],
        history: [{ isoDate: "2026-05-13", tier: "cap_reached" }],
      }),
    );
    expect(r.shouldNotify).toBe(true);
  });

  it("history for a different tier does NOT suppress current tier", () => {
    const r = decideScreenTimeOverage(
      input({
        todaySamples: [s("prodigy", 80)],
        history: [{ isoDate: TODAY, tier: "cap_reached" }],
      }),
    );
    expect(r.tier).toBe("plus_30");
    expect(r.shouldNotify).toBe(true);
  });

  it("kid headlines are non-punitive and never blocking", () => {
    const cap = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 45)] }));
    const p30 = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 75)] }));
    const p60 = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 110)] }));
    for (const h of [cap.kidHeadline, p30.kidHeadline, p60.kidHeadline]) {
      expect(h).toBeTruthy();
      expect(h!.toLowerCase()).not.toMatch(/no more|stop|too much|bad|punish|forbid/);
    }
  });

  it("adult notifyPayload includes counted vs cap minutes", () => {
    const r = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 50)] }));
    expect(r.notifyPayload?.content).toContain("counted 50 min vs cap 45 min");
  });

  it("negative or NaN sample minutes are ignored", () => {
    const r = decideScreenTimeOverage(
      input({
        todaySamples: [
          s("prodigy", -10),
          s("blooket", Number.NaN),
          s("seesaw", 20),
        ],
      }),
    );
    expect(r.countedMinutes).toBe(20);
    expect(r.tier).toBeNull();
  });

  it("capMinutes <= 0 ⇒ treated as 0, ANY non-allowed minutes trip cap_reached", () => {
    const r = decideScreenTimeOverage(
      input({ capMinutes: 0, todaySamples: [s("prodigy", 5)] }),
    );
    expect(r.capMinutes).toBe(0);
    expect(r.tier).toBe("cap_reached");
  });

  it("weekend cap of 60 → 90 counted is plus_30, not plus_60", () => {
    const r = decideScreenTimeOverage(
      input({ capMinutes: 60, todaySamples: [s("prodigy", 90)] }),
    );
    expect(r.tier).toBe("plus_30");
  });

  it("tierForMinutes pinned spec", () => {
    const t = __FOR_TEST__.tierForMinutes;
    expect(t(44, 45)).toBeNull();
    expect(t(45, 45)).toBe("cap_reached");
    expect(t(74, 45)).toBe("cap_reached");
    expect(t(75, 45)).toBe("plus_30");
    expect(t(104, 45)).toBe("plus_30");
    expect(t(105, 45)).toBe("plus_60");
  });

  it("tierAlreadyFiredToday matches by date+tier exactly", () => {
    const f = __FOR_TEST__.tierAlreadyFiredToday;
    const hist = [{ isoDate: "2026-05-14", tier: "cap_reached" as const }];
    expect(f(hist, "2026-05-14", "cap_reached")).toBe(true);
    expect(f(hist, "2026-05-14", "plus_30")).toBe(false);
    expect(f(hist, "2026-05-13", "cap_reached")).toBe(false);
    expect(f([], "2026-05-14", "cap_reached")).toBe(false);
  });

  it("ADULT_TEXT + KID_TEXT have entries for all 3 tiers", () => {
    for (const tier of ["cap_reached", "plus_30", "plus_60"] as const) {
      expect(__FOR_TEST__.ADULT_TEXT[tier].title).toBeTruthy();
      expect(__FOR_TEST__.ADULT_TEXT[tier].content).toBeTruthy();
      expect(__FOR_TEST__.KID_TEXT[tier]).toBeTruthy();
    }
  });

  it("deterministic — same input ⇒ identical output", () => {
    const a = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 50)] }));
    const b = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 50)] }));
    expect(a).toEqual(b);
  });

  it("empty samples ⇒ counted=0, no notify", () => {
    const r = decideScreenTimeOverage(input({}));
    expect(r.countedMinutes).toBe(0);
    expect(r.shouldNotify).toBe(false);
  });

  it("notifyPayload.category is exactly screen_time_overage (matches throttle)", () => {
    const r = decideScreenTimeOverage(input({ todaySamples: [s("prodigy", 50)] }));
    expect(r.notifyPayload?.category).toBe("screen_time_overage");
  });
});
