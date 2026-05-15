import { describe, it, expect } from "vitest";
import { getKiwiVoicePolicyManifest } from "./_lib/kiwiVoicePolicyVersion";

describe("kiwiVoicePolicyVersion — active guard manifest", () => {
  it("manifest has a non-empty entry list", () => {
    const m = getKiwiVoicePolicyManifest();
    expect(m.totalActive).toBeGreaterThan(0);
    expect(m.entriesByPushId.length).toBe(m.totalActive);
  });

  it("manifestVersion encodes the highest pushId", () => {
    const m = getKiwiVoicePolicyManifest();
    const maxPush = Math.max(...m.entriesByPushId.map((e) => e.pushId));
    expect(m.manifestVersion).toBe(`v${maxPush}`);
  });

  it("stage list matches the canonical order", () => {
    const m = getKiwiVoicePolicyManifest();
    expect(m.stages).toEqual([
      "pre_gen",
      "post_gen_text",
      "post_gen_tts",
      "audit",
      "review",
    ]);
  });

  it("entriesByPushId is sorted ascending", () => {
    const m = getKiwiVoicePolicyManifest();
    for (let i = 1; i < m.entriesByPushId.length; i += 1) {
      expect(m.entriesByPushId[i].pushId).toBeGreaterThan(
        m.entriesByPushId[i - 1].pushId,
      );
    }
  });

  it("each stage bucket is sorted ascending by pushId", () => {
    const m = getKiwiVoicePolicyManifest();
    for (const stage of m.stages) {
      const bucket = m.entriesByStage[stage];
      for (let i = 1; i < bucket.length; i += 1) {
        expect(bucket[i].pushId).toBeGreaterThan(bucket[i - 1].pushId);
      }
    }
  });

  it("no description contains exclamation marks (adult-tone)", () => {
    const m = getKiwiVoicePolicyManifest();
    for (const e of m.entriesByPushId) {
      expect(e.description).not.toContain("!");
    }
  });

  it("no description contains forbidden voice words", () => {
    const m = getKiwiVoicePolicyManifest();
    const forbid = /\b(yay|woohoo|great job|awesome|amazing|buddy|friend|pal|kiddo|sweetie)\b/i;
    for (const e of m.entriesByPushId) {
      expect(e.description).not.toMatch(forbid);
    }
  });

  it("entries reference real procedure names or null", () => {
    const m = getKiwiVoicePolicyManifest();
    for (const e of m.entriesByPushId) {
      if (e.procedure !== null) {
        expect(e.procedure).toMatch(/^today\.kiwi[A-Z][a-zA-Z]+$/);
      }
    }
  });

  it("the older_cousin Reagan-feedback rewrite (Push 216) is present", () => {
    const m = getKiwiVoicePolicyManifest();
    const drift = m.entriesByPushId.find((e) => e.pushId === 216);
    expect(drift).toBeDefined();
    expect(drift?.stage).toBe("post_gen_text");
    expect(drift?.procedure).toBe("today.kiwiToneDriftCheck");
  });

  it("the nickname guard from Push 228 is present", () => {
    const m = getKiwiVoicePolicyManifest();
    const guard = m.entriesByPushId.find((e) => e.pushId === 228);
    expect(guard).toBeDefined();
    expect(guard?.procedure).toBe("today.kiwiNicknameGuard");
  });

  it("review tab contains the dry-run dev tool", () => {
    const m = getKiwiVoicePolicyManifest();
    const review = m.entriesByStage.review;
    expect(review.some((e) => e.procedure === "today.kiwiFullRoundTripDryRun")).toBe(true);
  });

  it("audit stage covers persist + build + table", () => {
    const m = getKiwiVoicePolicyManifest();
    const audit = m.entriesByStage.audit;
    const procs = audit.map((e) => e.procedure);
    expect(procs).toContain("today.kiwiVoiceAuditEntryBuild");
    expect(procs).toContain("today.kiwiVoiceAuditPersist");
    // The table itself has procedure=null
    expect(audit.some((e) => e.procedure === null)).toBe(true);
  });

  it("returns a fresh copy — caller mutation doesn't affect source-of-truth", () => {
    const a = getKiwiVoicePolicyManifest();
    a.entriesByPushId.push({
      pushId: 9999,
      stage: "pre_gen",
      procedure: null,
      description: "Injected by test.",
    });
    const b = getKiwiVoicePolicyManifest();
    expect(b.entriesByPushId.some((e) => e.pushId === 9999)).toBe(false);
  });

  it("is deterministic — same call → same manifest", () => {
    const a = getKiwiVoicePolicyManifest();
    const b = getKiwiVoicePolicyManifest();
    expect(a).toEqual(b);
  });
});
