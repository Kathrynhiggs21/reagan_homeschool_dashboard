/**
 * Push 53 — Adult Notebook day-pinned reopen + Today/Yesterday quick buttons.
 *
 * Contract:
 *   1. NotebookDrawer initial state reads `notebook.lastDate` from
 *      localStorage, validates as YYYY-MM-DD, else defaults to today.
 *   2. Every date change goes through `setDateStrPinned` which persists back
 *      to localStorage so the panel reopens on the same day next time.
 *   3. The drawer surfaces Today + Yesterday quick-jump buttons that call
 *      setDateStrPinned, and highlight the active one with bg-amber-200.
 *   4. Camera + image + PDF upload entry points all remain wired to
 *      handleUpload — they were already there from the 2026-05-05 push, this
 *      push must not regress them.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const drawerSrc = fs.readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "NotebookDrawer.tsx"),
  "utf-8",
);

describe("Push 53 — Notebook day-pinned reopen", () => {
  it("reads notebook.lastDate from localStorage with YYYY-MM-DD validation", () => {
    expect(drawerSrc).toContain('window.localStorage.getItem("notebook.lastDate")');
    expect(drawerSrc).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });

  it("declares a setDateStrPinned helper that writes back to localStorage", () => {
    expect(drawerSrc).toContain("const setDateStrPinned = (next: string) =>");
    expect(drawerSrc).toContain('window.localStorage.setItem("notebook.lastDate", safe)');
  });

  it("renders Today + Yesterday quick buttons that call setDateStrPinned", () => {
    expect(drawerSrc).toContain("onClick={() => setDateStrPinned(today)}");
    expect(drawerSrc).toContain("onClick={() => setDateStrPinned(yesterdayISO)}");
    expect(drawerSrc).toContain("Today\n");
    expect(drawerSrc).toContain("Yesterday\n");
  });

  it("highlights the active quick-jump button with bg-amber-200", () => {
    expect(drawerSrc).toMatch(/dateStr === today \? "bg-amber-200/);
    expect(drawerSrc).toMatch(/dateStr === yesterdayISO \? "bg-amber-200/);
  });

  it("date <Input> uses setDateStrPinned so manual entry also persists", () => {
    const inputIdx = drawerSrc.indexOf('type="date"');
    expect(inputIdx).toBeGreaterThan(0);
    const slice = drawerSrc.slice(inputIdx, inputIdx + 400);
    expect(slice).toContain("setDateStrPinned(e.target.value || today)");
  });

  it("does NOT regress camera + image + PDF upload entry points", () => {
    expect(drawerSrc).toContain('accept="image/*"');
    expect(drawerSrc).toContain('capture="environment"');
    expect(drawerSrc).toContain('accept="application/pdf"');
    expect(drawerSrc).toContain("Take photo");
    expect(drawerSrc).toContain("Upload image");
    expect(drawerSrc).toContain("Upload PDF");
  });
});
