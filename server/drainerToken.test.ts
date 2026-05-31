/**
 * drainerToken (v3.23) — mint/verify vitest spec
 * ===============================================
 *
 * Locks the contract of `mintDrainerToken` and `verifyDrainerToken` so
 * the cookieless-drainer path can't silently regress. The signed-token
 * format and the verify gate are the only thing standing between a
 * leaked token and a malicious queue drain — so we exercise the
 * tampering, expiry, audience-mismatch, and signature-swap cases.
 *
 * Surface under test (from `_lib/drainerToken.ts`):
 *   - `mintDrainerToken(sub: string, opts?: { ttlSeconds?, now? }): string`
 *   - `verifyDrainerToken(token: unknown, opts?: { now? }):
 *        { ok: true; payload } | { ok: false; reason }`
 *   - `formatDrainerTokenLifetime(ttlSeconds: number): string`
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  mintDrainerToken,
  verifyDrainerToken,
  formatDrainerTokenLifetime,
  DRAINER_TOKEN_AUDIENCE,
  DRAINER_TOKEN_DEFAULT_TTL_SECONDS,
  DRAINER_TOKEN_MAX_TTL_SECONDS,
} from "./_lib/drainerToken";

beforeAll(() => {
  // JWT_SECRET must be ≥16 chars (enforced inside the module).
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || "test-secret-for-drainer-token-spec-1234567890";
});

describe("drainerToken — mint", () => {
  it("returns a 3-segment token tagged 'dt1'", () => {
    const token = mintDrainerToken("user-a");
    expect(typeof token).toBe("string");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("dt1");
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("defaults to a 15-minute TTL when none is provided", () => {
    const fixedNow = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", { now: fixedNow });
    const r = verifyDrainerToken(token, { now: fixedNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const lifetime = r.payload.exp - r.payload.iat;
      expect(lifetime).toBe(DRAINER_TOKEN_DEFAULT_TTL_SECONDS);
    }
  });

  it("clamps TTLs above the max to the max", () => {
    const fixedNow = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", {
      now: fixedNow,
      ttlSeconds: 60 * 60 * 24 * 30, // 30 days
    });
    const r = verifyDrainerToken(token, { now: fixedNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.exp - r.payload.iat).toBe(DRAINER_TOKEN_MAX_TTL_SECONDS);
    }
  });

  it("clamps TTLs below the floor (30s) to the floor", () => {
    const fixedNow = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", {
      now: fixedNow,
      ttlSeconds: 1,
    });
    const r = verifyDrainerToken(token, { now: fixedNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.exp - r.payload.iat).toBe(30);
    }
  });

  it("rejects empty sub", () => {
    expect(() => mintDrainerToken("")).toThrow();
  });

  it("two mints in the same millisecond produce different tokens (nonce salt)", () => {
    const fixedNow = 1_780_000_000_000;
    const a = mintDrainerToken("user-a", { now: fixedNow });
    const b = mintDrainerToken("user-a", { now: fixedNow });
    expect(a).not.toBe(b);
  });

  it("stamps the configured audience", () => {
    const token = mintDrainerToken("user-a");
    const r = verifyDrainerToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.aud).toBe(DRAINER_TOKEN_AUDIENCE);
  });

  it("stamps sub on the payload", () => {
    const token = mintDrainerToken("alice-openid");
    const r = verifyDrainerToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.sub).toBe("alice-openid");
  });
});

describe("drainerToken — verify", () => {
  it("accepts a freshly-minted token", () => {
    const token = mintDrainerToken("user-a");
    const r = verifyDrainerToken(token);
    expect(r.ok).toBe(true);
  });

  it("rejects empty / non-string", () => {
    expect(verifyDrainerToken("").ok).toBe(false);
    expect(verifyDrainerToken(undefined as any).ok).toBe(false);
    expect(verifyDrainerToken(null as any).ok).toBe(false);
    expect(verifyDrainerToken(42 as any).ok).toBe(false);
  });

  it("rejects malformed (wrong segment count)", () => {
    expect(verifyDrainerToken("not.a.token.extra").ok).toBe(false);
    expect(verifyDrainerToken("only.two").ok).toBe(false);
    expect(verifyDrainerToken("only-one-segment").ok).toBe(false);
  });

  it("rejects wrong tag", () => {
    const token = mintDrainerToken("user-a");
    const [, payload, sig] = token.split(".");
    const swapped = `xx.${payload}.${sig}`;
    const r = verifyDrainerToken(swapped);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("token-wrong-tag");
  });

  it("rejects a tampered payload", () => {
    const token = mintDrainerToken("user-a");
    const parts = token.split(".");
    const payload = parts[1];
    // Flip the last two chars of the payload — sig will no longer match.
    const flipped =
      payload.slice(0, -2) + (payload.slice(-2) === "AA" ? "BB" : "AA");
    const tampered = `${parts[0]}.${flipped}.${parts[2]}`;
    const r = verifyDrainerToken(tampered);
    expect(r.ok).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const original = process.env.JWT_SECRET!;
    process.env.JWT_SECRET = "secret-A-needs-16-chars-or-more-1234";
    const token = mintDrainerToken("user-a");
    process.env.JWT_SECRET = "secret-B-needs-16-chars-or-more-9876";
    const r = verifyDrainerToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("token-bad-signature");
    process.env.JWT_SECRET = original;
  });

  it("rejects an expired token via the `now` injection", () => {
    const issuedAt = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", {
      ttlSeconds: 30,
      now: issuedAt,
    });
    // 31 seconds later
    const r = verifyDrainerToken(token, { now: issuedAt + 31_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("token-expired");
  });

  it("rejects a token issued in the future beyond skew tolerance", () => {
    const issuedAt = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", { now: issuedAt });
    // Caller's clock is 5 minutes behind issuer — beyond the 60s skew window
    const r = verifyDrainerToken(token, { now: issuedAt - 5 * 60_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("token-issued-in-future");
  });

  it("tolerates small clock skew (≤60s)", () => {
    const issuedAt = 1_780_000_000_000;
    const token = mintDrainerToken("user-a", { now: issuedAt });
    const r = verifyDrainerToken(token, { now: issuedAt - 30_000 });
    expect(r.ok).toBe(true);
  });

  it("rejects a sig with bad base64", () => {
    const token = mintDrainerToken("user-a");
    const [tag, payload] = token.split(".");
    const r = verifyDrainerToken(`${tag}.${payload}.!!!not-base64!!!`);
    expect(r.ok).toBe(false);
  });

  it("rejects payload that decodes but has wrong shape", () => {
    // Synthesize a payload with the wrong audience, sign it correctly.
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const badPayload = {
      sub: "user-a",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
      aud: "wrong-audience",
      nonce: "deadbeef",
    };
    const b64 = (s: string) =>
      Buffer.from(s, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const payloadB64 = b64(JSON.stringify(badPayload));
    const signed = `dt1.${payloadB64}`;
    const sig = crypto
      .createHmac("sha256", process.env.JWT_SECRET!)
      .update(signed)
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `${signed}.${sig}`;
    const r = verifyDrainerToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("token-payload-shape");
  });
});

describe("drainerToken — formatDrainerTokenLifetime", () => {
  it("formats sub-minute values as seconds", () => {
    expect(formatDrainerTokenLifetime(0)).toBe("0 sec");
    expect(formatDrainerTokenLifetime(45)).toBe("45 sec");
  });

  it("formats sub-hour values as minutes", () => {
    expect(formatDrainerTokenLifetime(60)).toBe("1 min");
    expect(formatDrainerTokenLifetime(15 * 60)).toBe("15 min");
    expect(formatDrainerTokenLifetime(59 * 60 + 59)).toBe("59 min");
  });

  it("formats hours cleanly", () => {
    expect(formatDrainerTokenLifetime(3600)).toBe("1 hr");
    expect(formatDrainerTokenLifetime(3600 + 30 * 60)).toBe("1 hr 30 min");
    expect(formatDrainerTokenLifetime(2 * 3600 + 5 * 60)).toBe("2 hr 5 min");
  });

  it("clamps negative inputs to 0", () => {
    expect(formatDrainerTokenLifetime(-100)).toBe("0 sec");
  });
});
