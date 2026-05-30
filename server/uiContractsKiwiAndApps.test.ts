/**
 * Source-introspection tests for two UI contracts that don't have a DOM
 * test runner in this project:
 *
 *   1. KiwiPerch must expose a single-tap, accessible fly trigger
 *      (a real <button> with aria-label, distinct from the chat-open tap).
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

describe("KiwiPerch single-tap fly button contract", () => {
  const src = readSrc("client/src/components/KiwiPerch.tsx");

  it("renders a true <button> with the data-kiwi-fly-button hook", () => {
    expect(src).toMatch(/data-kiwi-fly-button/);
    // The marker must live on a real button element (not a span/div).
    expect(src).toMatch(/<button[\s\S]*?data-kiwi-fly-button/);
  });

  it("button has an aria-label so screen readers announce it", () => {
    expect(src).toMatch(/aria-label="Make Kiwi fly across the screen"/);
  });

  it("button calls the same flyAcrossRef helper used by the timer (no duplicate logic)", () => {
    // Both the timer effect and the button must call flyAcrossRef.current?.()
    const matches = src.match(/flyAcrossRef\.current\?\.\(\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("button is hidden during flight, drag, and adult presence (no spam)", () => {
    expect(src).toMatch(/!flying && !dragging && !adultPresent/);
  });

  it("does NOT replace the existing single-tap-on-Kiwi opens chat behavior", () => {
    // Single tap on Kiwi (not on the fly button) must still call setOpen.
    expect(src).toMatch(/setOpen\(!open\);/);
  });

  it("exposes window.flyKiwi() programmatic trigger for celebration moments", () => {
    expect(src).toMatch(/window as any\)\.flyKiwi/);
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
