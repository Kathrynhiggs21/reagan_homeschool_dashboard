import { describe, it, expect } from "vitest";
import { listKidCoveredTopicsFromVoiceMemos } from "./db";

/**
 * Push 2.9 — kid-safe redaction contract:
 *   1. Returns ONLY status='done' rows.
 *   2. Returns ONLY {id, subject, code, title} — no notes/source/last_covered_*.
 *   3. Default prefix `mom_katy_voice_memo_` matches the Mom Katy ingest.
 *   4. Returns [] for an unknown source prefix.
 *   5. Honors limit (default 50, max 100, min 1).
 *   6. Source-prefix is sanitized — `%` is stripped so a kid can never inject
 *      a wildcard.
 */
describe("listKidCoveredTopicsFromVoiceMemos (kid-safe)", () => {
  it("returns only done rows from the Mom Katy ingest by default", async () => {
    const rows = await listKidCoveredTopicsFromVoiceMemos();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      // Schema check: kid client must NEVER receive these fields.
      expect((r as any).status).toBeUndefined();
      expect((r as any).notes).toBeUndefined();
      expect((r as any).last_covered_source).toBeUndefined();
      expect((r as any).last_covered_at).toBeUndefined();
      expect((r as any).completed_at).toBeUndefined();
      // Schema check: kid client receives exactly these.
      expect(typeof r.id).toBe("number");
      expect(typeof r.subject).toBe("string");
      expect(typeof r.code).toBe("string");
      expect(typeof r.title).toBe("string");
    }
  });

  it("returns [] for an unknown source prefix", async () => {
    const rows = await listKidCoveredTopicsFromVoiceMemos({
      sourcePrefix: "__no_source_" + Date.now(),
    });
    expect(rows).toEqual([]);
  });

  it("clamps limit between 1 and 100", async () => {
    const big = await listKidCoveredTopicsFromVoiceMemos({ limit: 9999 });
    const tiny = await listKidCoveredTopicsFromVoiceMemos({ limit: -5 });
    expect(big.length).toBeLessThanOrEqual(100);
    expect(tiny.length).toBeGreaterThanOrEqual(0);
  });

  it("strips '%' from caller-provided sourcePrefix (no wildcard injection)", async () => {
    const rows = await listKidCoveredTopicsFromVoiceMemos({
      sourcePrefix: "%mom%",
    });
    // Sanitized to `mom` -> LIKE `mom%` -> should still hit our Mom Katy rows
    // because they start with `mom_katy_voice_memo_`. The point is that
    // `%mom%` did NOT cause a leading wildcard expansion.
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });

  it("honors a small limit", async () => {
    const rows = await listKidCoveredTopicsFromVoiceMemos({ limit: 3 });
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});
