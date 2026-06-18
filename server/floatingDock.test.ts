/**
 * floatingDock.test.ts — locks the 2026-06-18 behavior change: Reagan's dock
 * tools (Notebook / Timer / Calculator / Word Finder) open as DRAGGABLE,
 * NON-BLOCKING floating windows that stay open while she navigates the site,
 * rather than as blocking modal Dialogs.
 *
 * These are source-contract assertions (the same style as makeRequestPill.test.ts)
 * so we catch regressions without a full DOM render.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");
const dockSrc = fs.readFileSync(
  path.join(root, "client/src/components/ResourceDock.tsx"),
  "utf8",
);
const floatSrc = fs.readFileSync(
  path.join(root, "client/src/components/FloatingWindow.tsx"),
  "utf8",
);
const notebookSrc = fs.readFileSync(
  path.join(root, "client/src/components/KidNotebookPopup.tsx"),
  "utf8",
);

describe("Floating dock tools", () => {
  it("FloatingWindow exists and is draggable + closable (no blocking backdrop)", () => {
    // Drag handled via mouse + touch on the title bar.
    expect(floatSrc).toContain("cursor-move");
    expect(floatSrc).toMatch(/onMouseDown|onTouchStart/);
    // Re-clamps into the viewport so it can't be dragged off-screen.
    expect(floatSrc).toContain("clampToViewport");
    // Minimize + close controls.
    expect(floatSrc).toMatch(/Minimize/);
    expect(floatSrc).toMatch(/aria-label="Close"/);
    // NOT a Radix Dialog (no dimming backdrop that blocks the page).
    expect(floatSrc).not.toMatch(/from "@\/components\/ui\/dialog"/);
  });

  it("ResourceDock opens tools as FloatingWindows, not blocking Dialogs", () => {
    expect(dockSrc).toContain('import FloatingWindow from "@/components/FloatingWindow"');
    // The old blocking Dialog wrapper is gone.
    expect(dockSrc).not.toMatch(/from "@\/components\/ui\/dialog"/);
    // Each tool has its own independent open flag so several can float at once
    // and each persists across navigation.
    expect(dockSrc).toContain("timerOpen");
    expect(dockSrc).toContain("calcOpen");
    expect(dockSrc).toContain("dictOpen");
    expect(dockSrc).toContain("notebookOpen");
    // All four tools are still present in the dock.
    expect(dockSrc).toContain('label="Notebook"');
    expect(dockSrc).toContain('label="Timer"');
    expect(dockSrc).toContain('label="Calc"');
    expect(dockSrc).toContain('label="Word"');
    // Test ids for the floating windows.
    expect(dockSrc).toContain('testId="floating-timer"');
    expect(dockSrc).toContain('testId="floating-calc"');
    expect(dockSrc).toContain('testId="floating-dict"');
  });

  it("Notebook is a FloatingWindow too (stays open while navigating)", () => {
    expect(notebookSrc).toContain('import FloatingWindow from "@/components/FloatingWindow"');
    expect(notebookSrc).not.toMatch(/from "@\/components\/ui\/dialog"/);
    expect(notebookSrc).toContain('testId="floating-notebook"');
    // Still autosaves on close.
    expect(notebookSrc).toMatch(/void doSave\(\);\s*onClose\(\)/);
  });

  it("Kiwi can still open the notebook via the window event", () => {
    expect(dockSrc).toContain('"kiwi:open-notebook"');
  });
});
