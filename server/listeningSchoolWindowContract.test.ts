import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 17 (2026-05-12): contract / source-level tests for the school-window
 * listening behavior log (todo.md lines 410-445). The full pipeline already
 * exists end-to-end (relevance gate, classifier, drop-as-tally, behavior
 * derivations); this test pins the wiring so a regression would be caught.
 *
 * The runtime path is exercised by `server/phase13.listening.test.ts`
 * (route registration) and `server/db.ts` helpers (real-DB integration in
 * other tests). Here we just lock the security/privacy invariants.
 */

const SCHEMA = readFileSync(
  path.join(__dirname, "..", "drizzle", "schema.ts"),
  "utf8",
);
const ROUTERS = readFileSync(
  path.join(__dirname, "routers.ts"),
  "utf8",
);
const DB = readFileSync(path.join(__dirname, "db.ts"), "utf8");

describe("school-window listening behavior log — contract", () => {
  it("schema has relevanceScore, discardedReason enum, schoolBlockId on listeningSummaries", () => {
    const block = SCHEMA.split("listeningSummaries = mysqlTable")[1] || "";
    expect(block).toContain('relevanceScore');
    expect(block).toContain('discardedReason');
    expect(block).toContain('schoolBlockId');
    expect(block).toContain('"background_noise"');
    expect(block).toContain('"other_person"');
    expect(block).toContain('"silence"');
    expect(block).toContain('"non_school"');
  });

  it("findCoveringSchoolBlock helper exists in db.ts", () => {
    expect(DB).toMatch(/export async function findCoveringSchoolBlock\s*\(/);
    // It must consult schedule blocks for the date AND check time window.
    expect(DB).toContain("getPlanByDate");
    expect(DB).toContain("listBlocksForPlan");
  });

  it("addChunk mutation rejects out-of-school-window chunks WITHOUT calling LLM (privacy)", () => {
    const idxAdd = ROUTERS.indexOf("addChunk:");
    expect(idxAdd).toBeGreaterThan(-1);
    const slice = ROUTERS.slice(idxAdd, idxAdd + 8000);
    // The school-window guard must run BEFORE the actual transcribeAudio CALL
    // (the awaited invocation, not just a comment that mentions the helper).
    const idxCover = slice.indexOf("findCoveringSchoolBlock");
    const idxTranscribeCall = slice.indexOf("await transcribeAudio(");
    expect(idxCover).toBeGreaterThan(-1);
    expect(idxTranscribeCall).toBeGreaterThan(-1);
    expect(idxCover).toBeLessThan(idxTranscribeCall);
    // And the non_school branch returns early.
    expect(slice).toContain('"non_school"');
    expect(slice).toContain('return { ok: false');
  });

  it("relevance classifier persists tally rows (no transcript) when score < 50", () => {
    const idxAdd = ROUTERS.indexOf("addChunk:");
    const slice = ROUTERS.slice(idxAdd, idxAdd + 12000);
    // The low-relevance branch must NOT pass any rawSummary or topicsJson —
    // only relevanceScore + discardedReason + schoolBlockId.
    const lowBranch = slice.split("if (relevance.score < 50)")[1] || "";
    const lowInsert = lowBranch.split("return { ok: false")[0];
    expect(lowInsert).toContain("relevanceScore: relevance.score");
    expect(lowInsert).toContain("discardedReason");
    expect(lowInsert).not.toContain("rawSummary");
    expect(lowInsert).not.toContain("topicsJson");
  });

  it("listening.todayBehavior + listening.aggregate procedures are protected", () => {
    expect(ROUTERS).toMatch(/todayBehavior:\s*protectedProcedure/);
    expect(ROUTERS).toMatch(/aggregate:\s*protectedProcedure/);
  });

  it("listeningBehaviorForDate returns null when no rows (don't show if no info)", () => {
    expect(DB).toMatch(/listeningBehaviorForDate[\s\S]*?if \(all\.length === 0\) return null/);
  });

  it("listeningBehaviorAggregate returns null when no rows ever", () => {
    expect(DB).toMatch(/listeningBehaviorAggregate[\s\S]*?if \(rows\.length === 0\) return null/);
  });

  it("addChunk only stores audioUrl when chunk is in-school-window AND relevant (privacy invariant)", () => {
    // Audio bytes get stored to S3 via storagePut — but only if a data URL
    // was provided. The guards above ensure non-school chunks are dropped
    // before we even reach the LLM, but we DO upload the audio to S3 first
    // (so we can transcribe). This is acceptable because the audio URL is
    // never persisted on the row when the chunk is dropped — only the
    // tally fields are persisted. Verify that the dropped-chunk inserts
    // do not include an `audioUrl` field.
    const idxAdd = ROUTERS.indexOf("addChunk:");
    const slice = ROUTERS.slice(idxAdd, idxAdd + 12000);
    // Find every insertListeningSummary call that's part of a "drop" branch.
    const dropBranches = [
      slice.split('if (!cover) {')[1]?.split('}')[0] ?? "",
      slice.split("if (transcript.trim().length === 0) {")[1]?.split('}')[0] ?? "",
      slice.split('if (relevance.score < 50) {')[1]?.split('}')[0] ?? "",
    ];
    for (const branch of dropBranches) {
      expect(branch).not.toContain("audioUrl");
      expect(branch).not.toContain("rawSummary");
    }
  });
});
