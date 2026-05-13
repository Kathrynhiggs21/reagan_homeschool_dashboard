/**
 * Push 89 (2026-05-13) — Voice-print enrollment scaffold contract.
 *
 * Locks:
 *   - Token round-trip (sign → verify) for each intent.
 *   - Intent binding: a "playback" token CANNOT be verified as "verify".
 *   - Tamper detection on printId, intent, expiry.
 *   - Expiry honored (nowMs >= expiresAtMs → expired).
 *   - Reagan-only enrollment policy.
 *   - Mime + duration guards reject obviously bad samples.
 */
import { describe, it, expect } from "vitest";
import {
  signVoicePrintToken,
  verifyVoicePrintToken,
  mintEnrollAllowed,
  isAllowedVoiceMime,
  isAllowedVoiceDurationMs,
} from "./_lib/voicePrintSigning";

const SECRET = "test-secret-with-enough-length-1234567890";

describe("Push 89 — voice-print signed tokens", () => {
  it("round-trips playback intent", () => {
    const t = signVoicePrintToken(7, "playback", Date.now() + 60_000, SECRET);
    const r = verifyVoicePrintToken(t, "playback", SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.printId).toBe(7);
      expect(r.intent).toBe("playback");
    }
  });

  it("round-trips verify intent", () => {
    const t = signVoicePrintToken(42, "verify", Date.now() + 60_000, SECRET);
    const r = verifyVoicePrintToken(t, "verify", SECRET);
    expect(r.ok).toBe(true);
  });

  it("round-trips enroll-confirm intent", () => {
    const t = signVoicePrintToken(3, "enroll-confirm", Date.now() + 60_000, SECRET);
    const r = verifyVoicePrintToken(t, "enroll-confirm", SECRET);
    expect(r.ok).toBe(true);
  });

  it("rejects cross-intent (playback token cannot pass verify)", () => {
    const t = signVoicePrintToken(7, "playback", Date.now() + 60_000, SECRET);
    const r = verifyVoicePrintToken(t, "verify", SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-intent");
  });

  it("rejects tampered printId", () => {
    const t = signVoicePrintToken(7, "playback", Date.now() + 60_000, SECRET);
    // Replace the leading "7" with "8"; rest of token unchanged → signature now invalid.
    const tampered = "8" + t.slice(1);
    const r = verifyVoicePrintToken(tampered, "playback", SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason === "bad-signature" || r.reason === "malformed").toBe(true);
  });

  it("rejects expired tokens", () => {
    const past = Date.now() - 1000;
    const t = signVoicePrintToken(7, "playback", past + 1, SECRET);
    const r = verifyVoicePrintToken(t, "playback", SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects malformed tokens", () => {
    expect(verifyVoicePrintToken("not.a.token", "playback", SECRET).ok).toBe(false);
    expect(verifyVoicePrintToken("", "playback", SECRET).ok).toBe(false);
    expect(verifyVoicePrintToken("a.b.c.d.e", "playback", SECRET).ok).toBe(false);
  });

  it("refuses to sign with too-short secret", () => {
    expect(() => signVoicePrintToken(1, "playback", Date.now() + 1000, "short")).toThrow();
  });

  it("refuses to sign non-positive printId", () => {
    expect(() => signVoicePrintToken(0, "playback", Date.now() + 1000, SECRET)).toThrow();
    expect(() => signVoicePrintToken(-1, "playback", Date.now() + 1000, SECRET)).toThrow();
  });
});

describe("Push 89 — enrollment policy", () => {
  it("only student role may enroll a voice-print", () => {
    expect(mintEnrollAllowed("student")).toBe(true);
    expect(mintEnrollAllowed("parent")).toBe(false);
    expect(mintEnrollAllowed("editor")).toBe(false);
    expect(mintEnrollAllowed("tutor")).toBe(false);
    expect(mintEnrollAllowed("viewer")).toBe(false);
    expect(mintEnrollAllowed(null)).toBe(false);
    expect(mintEnrollAllowed(undefined)).toBe(false);
  });
});

describe("Push 89 — sample validation guards", () => {
  it("isAllowedVoiceMime accepts common audio mimes only", () => {
    expect(isAllowedVoiceMime("audio/webm")).toBe(true);
    expect(isAllowedVoiceMime("audio/mp4")).toBe(true);
    expect(isAllowedVoiceMime("AUDIO/WAV")).toBe(true);
    expect(isAllowedVoiceMime("video/mp4")).toBe(false);
    expect(isAllowedVoiceMime("image/png")).toBe(false);
    expect(isAllowedVoiceMime(null)).toBe(false);
    expect(isAllowedVoiceMime("")).toBe(false);
  });

  it("isAllowedVoiceDurationMs enforces 1.5s..15s window", () => {
    expect(isAllowedVoiceDurationMs(2000)).toBe(true);
    expect(isAllowedVoiceDurationMs(1500)).toBe(true);
    expect(isAllowedVoiceDurationMs(15_000)).toBe(true);
    expect(isAllowedVoiceDurationMs(1499)).toBe(false);
    expect(isAllowedVoiceDurationMs(15_001)).toBe(false);
    expect(isAllowedVoiceDurationMs(0)).toBe(false);
    expect(isAllowedVoiceDurationMs(NaN)).toBe(false);
    expect(isAllowedVoiceDurationMs(null)).toBe(false);
  });
});
