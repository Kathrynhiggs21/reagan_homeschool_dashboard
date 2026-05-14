import { describe, it, expect } from "vitest";
import {
  evaluateEnrollment,
  detectDrift,
} from "./_lib/reaganVoicePrintEnrollment";

const goodSample = (slot: 1 | 2 | 3, fp: string) => ({
  slot,
  fingerprint: fp,
  durationSec: 3.5,
  medianPitchHz: 260,
  rmsVolume: 0.4,
});

describe("Push 172 — Reagan voice-print enrollment", () => {
  it("returns 'high' confidence when all three samples are clean", () => {
    const r = evaluateEnrollment({
      samples: [goodSample(1, "a"), goodSample(2, "b"), goodSample(3, "c")],
    });
    expect(r.confidence).toBe("high");
    expect(r.ready).toBe(true);
    expect(r.voicePrintHash).toMatch(/^vp_3_/);
    expect(r.kidLine).toMatch(/Great job/i);
  });

  it("flags too-short samples for redo", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), durationSec: 1.0 },
        goodSample(2, "b"),
        goodSample(3, "c"),
      ],
    });
    expect(r.perSlot[0].status).toBe("redo");
    expect(r.perSlot[0].reason).toBe("too-short");
    expect(r.confidence).toBe("medium");
    expect(r.ready).toBe(true);
  });

  it("flags silent samples for redo", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), rmsVolume: 0 },
        goodSample(2, "b"),
        goodSample(3, "c"),
      ],
    });
    expect(r.perSlot[0].reason).toBe("silent");
  });

  it("flags low-volume samples for redo", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), rmsVolume: 0.02 },
        goodSample(2, "b"),
        goodSample(3, "c"),
      ],
    });
    expect(r.perSlot[0].reason).toBe("low-volume");
  });

  it("flags adult-band pitch samples for redo", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), medianPitchHz: 130 },
        goodSample(2, "b"),
        goodSample(3, "c"),
      ],
    });
    expect(r.perSlot[0].reason).toBe("adult-voice");
  });

  it("flags duplicate-fingerprint samples for redo on both sides", () => {
    const r = evaluateEnrollment({
      samples: [goodSample(1, "x"), goodSample(2, "x"), goodSample(3, "c")],
    });
    expect(r.perSlot[0].reason).toBe("duplicate");
    expect(r.perSlot[1].reason).toBe("duplicate");
    expect(r.confidence).toBe("low");
  });

  it("returns 'unusable' when none pass", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), rmsVolume: 0 },
        { ...goodSample(2, "b"), durationSec: 0.5 },
        { ...goodSample(3, "c"), medianPitchHz: 100 },
      ],
    });
    expect(r.confidence).toBe("unusable");
    expect(r.ready).toBe(false);
  });

  it("kid line never mentions adult names or mic permission", () => {
    const r = evaluateEnrollment({
      samples: [
        { ...goodSample(1, "a"), rmsVolume: 0 },
        { ...goodSample(2, "b"), durationSec: 0.5 },
        goodSample(3, "c"),
      ],
    });
    expect(r.kidLine.toLowerCase()).not.toMatch(/mom|grandma|mic|microphone/);
  });

  it("voicePrintHash is deterministic across same fingerprints regardless of order", () => {
    const a = evaluateEnrollment({
      samples: [goodSample(1, "a"), goodSample(2, "b"), goodSample(3, "c")],
    }).voicePrintHash;
    const b = evaluateEnrollment({
      samples: [goodSample(1, "c"), goodSample(2, "a"), goodSample(3, "b")],
    }).voicePrintHash;
    expect(a).toBe(b);
  });

  it("voicePrintHash differs when an OK sample is replaced", () => {
    const a = evaluateEnrollment({
      samples: [goodSample(1, "a"), goodSample(2, "b"), goodSample(3, "c")],
    }).voicePrintHash;
    const b = evaluateEnrollment({
      samples: [goodSample(1, "a"), goodSample(2, "b"), goodSample(3, "z")],
    }).voicePrintHash;
    expect(a).not.toBe(b);
  });
});

describe("Push 172 — drift detection", () => {
  const recentMatched = Array.from({ length: 8 }, () => ({ matchScore: 0.85 }));
  const recentMostlyMissed = Array.from({ length: 8 }, () => ({ matchScore: 0.3 }));

  it("does not suggest re-enroll when match rate is high", () => {
    const r = detectDrift({
      enrolledConfidence: "high",
      enrolledHash: "vp_3_abc",
      recentChunks: recentMatched,
    });
    expect(r.shouldSuggestReenroll).toBe(false);
  });

  it("suggests re-enroll when ≥60% of recent chunks fail", () => {
    const r = detectDrift({
      enrolledConfidence: "high",
      enrolledHash: "vp_3_abc",
      recentChunks: recentMostlyMissed,
    });
    expect(r.shouldSuggestReenroll).toBe(true);
    expect(r.reason).toBe("low-match-rate");
    expect(r.kidLine).toMatch(/fresh sample/i);
    expect(r.kidLine?.toLowerCase()).not.toMatch(/your voice changed/);
  });

  it("never suggests re-enroll for low/unusable enrollments", () => {
    expect(
      detectDrift({
        enrolledConfidence: "low",
        enrolledHash: "vp_1_x",
        recentChunks: recentMostlyMissed,
      }).shouldSuggestReenroll,
    ).toBe(false);
    expect(
      detectDrift({
        enrolledConfidence: "unusable",
        enrolledHash: "",
        recentChunks: recentMostlyMissed,
      }).shouldSuggestReenroll,
    ).toBe(false);
  });

  it("does not fire on too-few samples", () => {
    const r = detectDrift({
      enrolledConfidence: "high",
      enrolledHash: "vp_3_abc",
      recentChunks: [{ matchScore: 0.1 }, { matchScore: 0.1 }],
    });
    expect(r.shouldSuggestReenroll).toBe(false);
    expect(r.reason).toBe("too-few-samples");
  });
});
