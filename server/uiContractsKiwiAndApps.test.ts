/**
 * Source-introspection tests for two UI contracts that don't have a DOM
 * test runner in this project:
 *
 *   1. KiwiPerch must NOT show the always-on airplane fly button, and the
 *      fly-across (airplane whoosh) action must be retired (per Katy,
 *      2026-06-18). Kiwi still roams and is draggable; single tap still
 *      opens chat.
 *   2. Apps page must render BOTH Student and Parent <a> links on Google
 *      app cards when both emails are configured, with Student first
 *      (= the default identity).
 *
 * These tests read the source files and assert that the markers we rely
 * on are present. They will fail if either feature is removed without
 * also updating the test (which is exactly what we want).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("KiwiPerch — airplane fly action retired, roaming kept", () => {
  const src = readSrc("client/src/components/KiwiPerch.tsx");

  it("no longer renders the always-on airplane fly button", () => {
    expect(src).not.toMatch(/data-kiwi-fly-button/);
    expect(src).not.toMatch(/aria-label="Make Kiwi fly across the screen"/);
  });

  it("fly-across action is a no-op (no setFlying(true) launch)", () => {
    // The airplane whoosh set flying state true; it must be gone.
    expect(src).not.toMatch(/setFlying\(true\)/);
  });

  it("double-tap on Kiwi no longer triggers the airplane whoosh", () => {
    expect(src).not.toMatch(/Wheee! ✈️/);
  });

  it("single tap on Kiwi still opens chat (interaction preserved)", () => {
    expect(src).toMatch(/setOpen\(!open\);/);
  });

  it("Kiwi still roams/idles and remains draggable (movement preserved)", () => {
    // Roaming guards reference the flying flag; drag handlers remain.
    expect(src).toMatch(/!dragging && !flying/);
    expect(src).toMatch(/dragging/);
  });

  it("window.flyKiwi() hook still exists but is harmless (no-op ref)", () => {
    expect(src).toMatch(/window as any\)\.flyKiwi/);
    expect(src).toMatch(/flyAcrossRef\.current = \(\) => \{\};/);
  });
});

describe("Apps page dual sign-in card contract", () => {
  const src = readSrc("client/src/pages/Apps.tsx");

  it("renders an interactive Student link on Google app cards (data-student-signin)", () => {
    expect(src).toMatch(/data-student-signin/);
    // Must be on an <a>, not a non-interactive <span>.
    expect(src).toMatch(/<a[\s\S]*?data-student-signin/);
  });

  it("renders an interactive Parent link on Google app cards (data-parent-signin)", () => {
    expect(src).toMatch(/data-parent-signin/);
    expect(src).toMatch(/<a[\s\S]*?data-parent-signin/);
  });

  it("Student appears BEFORE Parent in source order (= default primary action)", () => {
    const studentIdx = src.indexOf("data-student-signin");
    const parentIdx = src.indexOf("data-parent-signin");
    expect(studentIdx).toBeGreaterThan(0);
    expect(parentIdx).toBeGreaterThan(studentIdx);
  });

  it("Both links use withGoogleSsoHint with their respective emails", () => {
    expect(src).toMatch(/withGoogleSsoHint\(a\.url, reaganEmail\)/);
    expect(src).toMatch(/withGoogleSsoHint\(a\.url, dadEmail\)/);
  });

  it("Both links are gated on having BOTH emails configured + Google URL", () => {
    expect(src).toMatch(/dadEmail && reaganEmail && isGoogleUrl/);
  });

  it("Container is marked with data-dual-signin for downstream styling/tests", () => {
    expect(src).toMatch(/data-dual-signin/);
  });

  it("Both links have descriptive aria-labels", () => {
    expect(src).toMatch(/aria-label=\{`Open \$\{a\.name\} as Student`\}/);
    expect(src).toMatch(/aria-label=\{`Open \$\{a\.name\} as Parent`\}/);
  });
});
