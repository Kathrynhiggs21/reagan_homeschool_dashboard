import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v2.43 (2026-05-18) — Analytics top-level page MUST have an "Open in Drive"
 * button at the page header (the existing OpenInDrive helper was only mounted
 * on three sub-sections; the root archive link was missing).
 */

const ANALYTICS = resolve(__dirname, "..", "client/src/pages/Analytics.tsx");

function read() {
  return readFileSync(ANALYTICS, "utf-8");
}

describe("v2.43 — Analytics root Open in Drive", () => {
  it("renders OpenInDrive once at the page header with the root data-testid", () => {
    const src = read();
    expect(src).toMatch(/data-testid="analytics-open-in-drive-root"/);
  });

  it("the root Open in Drive uses an explicit label (not the default)", () => {
    const src = read();
    expect(src).toMatch(/<OpenInDrive label="Open root Analytics folder in Drive"/);
  });

  it("DRIVE_HUB_URL points at the Reagan School Hub Analytics archive", () => {
    const src = read();
    expect(src).toMatch(/Reagan%20School%20Hub%20Analytics/);
  });

  it("preserves the three section-level Open in Drive mounts (Day Summaries, Kiwi AI, IEP)", () => {
    const src = read();
    expect(src).toMatch(/<OpenInDrive label="Day Summaries in Drive"/);
    expect(src).toMatch(/<OpenInDrive label="Kiwi AI in Drive"/);
    expect(src).toMatch(/<OpenInDrive label="Goals \/ IEP-style Plans in Drive"/);
  });

  it("OpenInDrive is rendered inside the page header (above ParentFlagsBanner)", () => {
    const src = read();
    const headerIdx = src.indexOf('analytics-open-in-drive-root');
    const flagsIdx = src.indexOf('<ParentFlagsBanner');
    expect(headerIdx).toBeGreaterThan(0);
    expect(flagsIdx).toBeGreaterThan(headerIdx);
  });
});
