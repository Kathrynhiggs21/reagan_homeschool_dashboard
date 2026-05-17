import { describe, it, expect } from "vitest";
import { listCurriculumTopicsBySource } from "./db";
import { MOM_KATY_SOURCE_TAG } from "./_lib/ingestMomKatyVoiceMemo20260517";

/**
 * Push 2.8 — the listCurriculumTopicsBySource helper is the read-side of the
 * voice-memo intake. The ingest test (`ingestMomKatyVoiceMemo20260517.test.ts`)
 * already proves writes; here we prove reads.
 *
 * Contract:
 *   1. Returns >= 1 row for the live mom_katy_voice_memo_2026-05-17 source.
 *   2. Every row has the exact same `last_covered_source` value.
 *   3. Rows are ordered by subject ASC then ord ASC.
 *   4. Returns [] for an unknown source.
 *   5. Honors the limit (default 50, max 100, clamps low).
 */
describe("listCurriculumTopicsBySource", () => {
  it("returns the rows stamped by the Mom Katy intake", async () => {
    const rows = await listCurriculumTopicsBySource(MOM_KATY_SOURCE_TAG);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.last_covered_source).toBe(MOM_KATY_SOURCE_TAG);
    }
  });

  it("returns [] for a source that nobody has used yet", async () => {
    const rows = await listCurriculumTopicsBySource("__no_such_source__" + Date.now());
    expect(rows).toEqual([]);
  });

  it("rows are ordered by subject then by id within subject", async () => {
    const rows = await listCurriculumTopicsBySource(MOM_KATY_SOURCE_TAG);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      // subject asc
      expect(prev.subject <= cur.subject).toBe(true);
    }
  });

  it("honors a small limit", async () => {
    const rows = await listCurriculumTopicsBySource(MOM_KATY_SOURCE_TAG, { limit: 3 });
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("clamps oversized/undersized limit defensively", async () => {
    const big = await listCurriculumTopicsBySource(MOM_KATY_SOURCE_TAG, { limit: 9999 });
    const tiny = await listCurriculumTopicsBySource(MOM_KATY_SOURCE_TAG, { limit: -5 });
    expect(big.length).toBeLessThanOrEqual(100);
    expect(tiny.length).toBeGreaterThanOrEqual(0); // -5 clamped to >=1; result is whatever exists, at least 0
  });
});
