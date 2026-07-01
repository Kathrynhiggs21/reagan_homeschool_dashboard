/**
 * Push 36 — Tutor focus mode (2026-05-13).
 *
 * Mom wants a single toggle in the unlocked adult sidebar that, when on:
 *   1. Reduces the For-Adults list to Curriculum Hub + Agenda Editor + Notebook.
 *   2. Hides the Drive Hub external link in the same sidebar.
 *   3. Shows a yellow banner at the top of the Agenda Editor explaining
 *      that Analytics / Settings are hidden.
 *   4. Is persisted server-side via `appSettings` key "tutor.mode"
 *      ("1" / "0") so refreshing or switching devices keeps the mode.
 *   5. Is readable from a kid/tutor session (no adult passcode), via the
 *      `prefs.getPublic` allow-list.
 *
 * These are source-level contract checks because the toggle is a
 * thin wrapper over an existing tested setting key — no new procedure
 * or table; the underlying `prefs.set` mutation already has e2e coverage
 * elsewhere.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Tutor focus mode — push 36", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const dockSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "components", "OrbDock.tsx"),
    "utf-8",
  );
  const hookSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "hooks", "useTutorMode.ts"),
    "utf-8",
  );
  const agendaSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "AgendaEditor.tsx"),
    "utf-8",
  );

  it("tutor.mode key is in the publicProcedure prefs.getPublic allow-list", () => {
    // Public-readable so kid + tutor sessions can render the banner.
    expect(routersSrc).toContain('"tutor.mode"');
    expect(routersSrc).toMatch(/tutor\.mode.*push 36/);
  });

  it("useTutorMode hook reads from prefs.getPublic with key 'tutor.mode'", () => {
    expect(hookSrc).toContain('const KEY = "tutor.mode"');
    expect(hookSrc).toContain("trpc.prefs.getPublic.useQuery({ key: KEY })");
    expect(hookSrc).toContain("trpc.prefs.set.useMutation");
  });

  it("useTutorMode writes '1' for on and '0' for off (string flag)", () => {
    expect(hookSrc).toContain('value: next ? "1" : "0"');
  });

  it("hook exposes enabled / setEnabled / toggle", () => {
    expect(hookSrc).toMatch(/enabled: boolean/);
    expect(hookSrc).toMatch(/setEnabled: \(next: boolean\) => void/);
    expect(hookSrc).toMatch(/toggle: \(\) => void/);
  });

  it("OrbDock filters ADULT_ORBS to the focus pages when tutor mode is on", () => {
    expect(dockSrc).toContain('TUTOR_FOCUS_PATHS = new Set(["/curriculum", "/agenda-editor", "/notes"])');
    expect(dockSrc).toContain("adultOrbs = tutorModeOn");
    expect(dockSrc).toContain("ADULT_ORBS.filter((o) => TUTOR_FOCUS_PATHS.has(o.to))");
  });

  it("OrbDock hides the Drive Hub link when tutor mode is on", () => {
    expect(dockSrc).toContain("{!tutorModeOn && (");
    // The Drive Hub anchor is guarded by !tutorModeOn — search for both.
    const idx = dockSrc.indexOf("{!tutorModeOn && (");
    const slice = dockSrc.slice(idx, idx + 600);
    expect(slice).toContain("DRIVE_HUB_URL");
  });

  it("OrbDock renders a Tutor Mode toggle button when adult area is unlocked", () => {
    expect(dockSrc).toContain("Tutor ON");
    expect(dockSrc).toContain("Tutor mode");
    expect(dockSrc).toContain("setTutorMode(!tutorModeOn)");
  });

  it("AgendaEditor shows a banner when tutor mode is on", () => {
    expect(agendaSrc).toContain('useTutorMode');
    expect(agendaSrc).toContain('data-testid="tutor-mode-banner"');
    expect(agendaSrc).toContain("Tutor mode is on.");
  });

  it("AgendaEditor banner offers a Turn off button that flips the toggle", () => {
    expect(agendaSrc).toMatch(/setTutorMode\(false\)/);
  });
});
