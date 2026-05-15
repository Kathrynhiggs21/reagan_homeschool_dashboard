import { describe, it, expect } from "vitest";
import {
  decideKidConsent,
  __FOR_TEST__,
  type ConsentTap,
} from "./_lib/kidConsentSignals";

const START = "2026-05-14T15:00:00.000Z";
function at(min: number): string {
  return new Date(Date.parse(START) + min * 60000).toISOString();
}
function tap(signal: ConsentTap["signal"], min: number, subject?: string): ConsentTap {
  return { signal, isoTimestamp: at(min), subject };
}

describe("Push 204 — kidConsentSignals", () => {
  it("empty taps + short session ⇒ keep_going (no nag)", () => {
    const r = decideKidConsent({
      taps: [],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(5),
    });
    expect(r.recommendation).toBe("keep_going");
    expect(r.sessionMinutes).toBe(5);
    expect(r.kidLine.toLowerCase()).not.toMatch(/buddy|friend|yay|great job/);
  });

  it("im_done tap ⇒ wrap_up, no questions", () => {
    const r = decideKidConsent({
      taps: [tap("keep_going", 10), tap("im_done", 22)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(25),
    });
    expect(r.recommendation).toBe("wrap_up");
    expect(r.kidLine).toBe("Got it. Done for now.");
  });

  it("switch_subject tap ⇒ offer_switch", () => {
    const r = decideKidConsent({
      taps: [tap("switch_subject", 15)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(16),
    });
    expect(r.recommendation).toBe("offer_switch");
  });

  it("session >= 45 min + recent keep_going ⇒ offer_break (gentle)", () => {
    const r = decideKidConsent({
      taps: [tap("keep_going", 20), tap("keep_going", 40)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(50),
    });
    expect(r.recommendation).toBe("offer_break");
    expect(r.kidLine).toContain("short break is fine");
  });

  it("switch_subject as last tap fires Rule 2 (offer_switch beats break)", () => {
    const r = decideKidConsent({
      taps: [tap("switch_subject", 10)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(30),
    });
    expect(r.recommendation).toBe("offer_switch");
  });

  it("session 30 min + no taps at all ⇒ offer_break (no recent keep_going)", () => {
    const r = decideKidConsent({
      taps: [],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(30),
    });
    expect(r.recommendation).toBe("offer_break");
  });

  it("session 30 min + recent keep_going ⇒ keep_going (honor flow)", () => {
    const r = decideKidConsent({
      taps: [tap("keep_going", 28)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(30),
    });
    expect(r.recommendation).toBe("keep_going");
  });

  it("im_done at the very end takes precedence over long session", () => {
    const r = decideKidConsent({
      taps: [
        tap("keep_going", 10),
        tap("keep_going", 30),
        tap("im_done", 55),
      ],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(56),
    });
    expect(r.recommendation).toBe("wrap_up");
  });

  it("kidLine is always calm, never has forbidden creepy-cute words", () => {
    const inputs = [
      { taps: [], curr: at(5) },
      { taps: [tap("keep_going", 30)], curr: at(50) },
      { taps: [tap("im_done", 10)], curr: at(11) },
      { taps: [tap("switch_subject", 10)], curr: at(11) },
      { taps: [], curr: at(30) },
    ];
    for (const i of inputs) {
      const r = decideKidConsent({
        taps: i.taps,
        sessionStartedAtIso: START,
        currentIsoTimestamp: i.curr,
      });
      expect(r.kidLine).toBeTruthy();
      expect(r.kidLine.toLowerCase()).not.toMatch(
        /buddy|friend\b|yay|woohoo|great job|amazing|awesome|!{2}/,
      );
    }
  });

  it("invalid ISO timestamps ⇒ sessionMinutes=0, falls back to keep_going", () => {
    const r = decideKidConsent({
      taps: [],
      sessionStartedAtIso: "not-a-date",
      currentIsoTimestamp: "also-bad",
    });
    expect(r.sessionMinutes).toBe(0);
    expect(r.recommendation).toBe("keep_going");
  });

  it("deterministic — same input ⇒ identical output", () => {
    const input = {
      taps: [tap("keep_going", 20), tap("keep_going", 42)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(50),
    };
    expect(decideKidConsent(input)).toEqual(decideKidConsent(input));
  });

  it("KID_LINES has entries for all 4 recommendations + no creepy-cute words", () => {
    for (const rec of ["keep_going", "offer_break", "offer_switch", "wrap_up"] as const) {
      expect(__FOR_TEST__.KID_LINES[rec]).toBeTruthy();
      expect(__FOR_TEST__.KID_LINES[rec].toLowerCase()).not.toMatch(
        /buddy|friend\b|yay|woohoo|great job/,
      );
    }
  });

  it("minutesBetween: pinned spec", () => {
    const m = __FOR_TEST__.minutesBetween;
    expect(m(START, at(0))).toBe(0);
    expect(m(START, at(1))).toBe(1);
    expect(m(START, at(45))).toBe(45);
    expect(m("bad", at(10))).toBe(0);
    expect(m(at(20), START)).toBe(0);
  });

  it("sessionMinutes returned correctly across all branches", () => {
    expect(
      decideKidConsent({
        taps: [],
        sessionStartedAtIso: START,
        currentIsoTimestamp: at(13),
      }).sessionMinutes,
    ).toBe(13);
    expect(
      decideKidConsent({
        taps: [tap("im_done", 5)],
        sessionStartedAtIso: START,
        currentIsoTimestamp: at(7),
      }).sessionMinutes,
    ).toBe(7);
  });

  it("reason field always set (logged adult-side)", () => {
    const r = decideKidConsent({
      taps: [tap("keep_going", 5)],
      sessionStartedAtIso: START,
      currentIsoTimestamp: at(10),
    });
    expect(r.reason).toBeTruthy();
    expect(typeof r.reason).toBe("string");
  });
});
