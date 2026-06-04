/**
 * Push 137 (2026-05-13) — Spelling-practice deeplink + coin reward contract.
 *
 * Pins:
 *   - constants are 3 base / +1 perfect bonus / 80% threshold / 30-min daily cap
 *   - deeplink is built from canonical Push 116 helper (always returns one
 *     for valid subject+provider, even when the reward is rejected)
 *   - subject != "spelling" → no reward (but deeplink may still be returned
 *     for a fun-only practice surface)
 *   - missing/empty listId → rejected, no deeplink
 *   - completionPercent < 80 → rejected
 *   - listId already awarded today → rejected
 *   - dailyExtraSpellingMinutesSoFar ≥ 30 → rejected
 *   - 100% completion grants perfect bonus (+1 coin)
 *   - 80–99% completion grants base 3 coins
 *   - non-finite inputs rejected
 */
import { describe, it, expect } from "vitest";
import {
  SPELLING_REWARD_BASE_COINS,
  SPELLING_REWARD_PERFECT_BONUS,
  SPELLING_REWARD_MIN_PERCENT,
  SPELLING_REWARD_DAILY_MINUTES_CAP,
  decideSpellingPracticeReward,
} from "./_lib/spellingPracticeReward";

describe("Push 137 — decideSpellingPracticeReward", () => {
  it("ships canonical reward constants", () => {
    expect(SPELLING_REWARD_BASE_COINS).toBe(3);
    expect(SPELLING_REWARD_PERFECT_BONUS).toBe(1);
    expect(SPELLING_REWARD_MIN_PERCENT).toBe(80);
    expect(SPELLING_REWARD_DAILY_MINUTES_CAP).toBe(30);
  });

  it("rejects when listId is missing", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "",
      provider: "ixl",
      completionPercent: 100,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) {
      expect(out.reason).toBe("missing-list-id");
      expect(out.deeplink).toBeNull();
    }
  });

  it("rejects when subject is not spelling but still returns a deeplink for fun practice", () => {
    const out = decideSpellingPracticeReward({
      subject: "math",
      listId: "list-123",
      provider: "khan",
      completionPercent: 100,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) {
      expect(out.reason).toBe("wrong-subject");
      expect(out.deeplink).not.toBeNull();
      expect(out.deeplink?.subject).toBe("math");
      expect(out.deeplink?.provider).toBe("khan");
    }
  });

  it("rejects when completionPercent is below threshold", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-1",
      provider: "ixl",
      completionPercent: 70,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("below-completion-threshold");
  });

  it("rejects when listId was already awarded today", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-A",
      provider: "ixl",
      completionPercent: 100,
      estimatedMinutes: 10,
      alreadyAwardedListIdsToday: ["list-A", "list-B"],
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("already-awarded-today");
  });

  it("rejects when daily minutes cap is reached", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-1",
      provider: "ixl",
      completionPercent: 100,
      estimatedMinutes: 10,
      dailyExtraSpellingMinutesSoFar: 30,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("daily-minutes-cap-reached");
  });

  it("grants base coins for 80–99% completion", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-1",
      provider: "ixl",
      completionPercent: 85,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(true);
    if (out.grant) {
      expect(out.coins).toBe(3);
      expect(out.reason).toBe("granted");
      expect(out.deeplink.subject).toBe("spelling");
    }
  });

  it("grants base + perfect bonus for 100% completion", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-1",
      provider: "khan",
      completionPercent: 100,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(true);
    if (out.grant) {
      expect(out.coins).toBe(4);
      expect(out.reason).toBe("granted-perfect");
      expect(out.deeplink.subject).toBe("spelling");
      expect(out.deeplink.provider).toBe("khan");
    }
  });

  it("rejects non-finite completionPercent", () => {
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-1",
      provider: "ixl",
      completionPercent: NaN,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(false);
    if (!out.grant) expect(out.reason).toBe("non-finite-input");
  });

  it("topic is slugified and preserved, but an UNVERIFIED slug degrades to the known-good spelling root (v3.31)", () => {
    // v3.31: "compound-words" is not on the verified allow-list for spelling,
    // so rather than ship a likely-404 deep link, the builder falls back to
    // the known-good IXL spelling-patterns page. The requested slug is still
    // preserved on the plan for telemetry/UX.
    const out = decideSpellingPracticeReward({
      subject: "spelling",
      listId: "list-7",
      topic: "Compound Words",
      provider: "ixl",
      completionPercent: 100,
      estimatedMinutes: 10,
    });
    expect(out.grant).toBe(true);
    if (out.grant) {
      // Slug is still derived and preserved.
      expect(out.deeplink.topic).toBe("compound-words");
      // ...but the URL is the verified spelling root, not a guessed segment.
      expect(out.deeplink.url).toContain("spelling-patterns");
      expect(out.deeplink.url).not.toContain("compound-words");
    }
  });
});
