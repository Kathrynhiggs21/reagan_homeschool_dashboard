import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test for the per-block "Print worksheet" button (2026-06-18).
 *
 * It must reuse the EXISTING worksheets backend (forBlock + makePdf), open
 * the resulting PDF, and be mounted in the AgendaEditor block row. No new
 * server procedures should be required.
 */

const root = join(__dirname, "..");
const btn = readFileSync(
  join(root, "client/src/components/PrintWorksheetButton.tsx"),
  "utf8",
);
const editor = readFileSync(
  join(root, "client/src/pages/AgendaEditor.tsx"),
  "utf8",
);
const routers = readFileSync(join(root, "server/routers.ts"), "utf8");

describe("PrintWorksheetButton", () => {
  it("reuses worksheets.forBlock and worksheets.makePdf (no new procedures)", () => {
    expect(btn).toMatch(/trpc\.worksheets\.forBlock\.useMutation/);
    expect(btn).toMatch(/trpc\.worksheets\.makePdf\.useMutation/);
    // Both procedures must still exist on the server.
    expect(routers).toMatch(/forBlock:\s*protectedProcedure/);
    expect(routers).toMatch(/makePdf:\s*protectedProcedure/);
  });

  it("opens the rendered PDF url and skips non-academic blocks", () => {
    expect(btn).toMatch(/window\.open\(/);
    expect(btn).toMatch(/res\.nonAcademic/);
    expect(btn).toMatch(/pdf\?\.url|pdf\.url/);
  });

  it("is mounted in the AgendaEditor block row", () => {
    expect(editor).toMatch(/import \{ PrintWorksheetButton \}/);
    expect(editor).toMatch(/<PrintWorksheetButton/);
  });

  it("guards against double-clicks while preparing", () => {
    expect(btn).toMatch(/if \(busy\) return/);
    expect(btn).toMatch(/disabled=\{busy\}/);
  });
});
