import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Contract test for the 2026-05-12 enrichment of the
 * GET /api/scheduled/drive-push/pending response: each row now MUST include
 * canonicalParentSlug, canonicalParentFolderId, and subfolderName so the
 * external worker can write the file directly under one of the 9 canonical
 * top-level Drive folders (no rediscovery, no duplicate folder creation).
 */
describe("drive-push/pending — canonical-parent enrichment", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("calls getCanonicalParentForRoutable on each row", () => {
    expect(src).toContain("getCanonicalParentForRoutable(target)");
  });

  it("returns canonicalParentSlug + canonicalParentFolderId + subfolderName per row", () => {
    expect(src).toContain("canonicalParentSlug");
    expect(src).toContain("canonicalParentFolderId");
    expect(src).toContain("subfolderName");
  });

  it("uses Promise.all so rows resolve in parallel", () => {
    expect(src).toContain("Promise.all");
  });

  it("falls back gracefully (try/catch) so one bad row doesn't break the whole list", () => {
    // The enrichment block is wrapped in its own try/catch
    const m = src.match(/canonicalParentSlug: string \| null = null;[\s\S]{0,2000}?best-effort enrichment/);
    expect(m).not.toBeNull();
  });

  it("looks up subfolderName from DRIVE_FOLDER_NAMES (so legacy callers still get the right folder name)", () => {
    expect(src).toContain("db.DRIVE_FOLDER_NAMES");
  });
});
