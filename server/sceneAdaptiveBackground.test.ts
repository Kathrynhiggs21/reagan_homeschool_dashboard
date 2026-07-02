import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Scene-adaptive liquid-glass background contract (Katy, 2026-07-01).
 *
 * The whole app shows ONE canonical glass theme over a full-bleed nature photo.
 * The photo (and the glass accent tint) must shift with the LIVE weather + time
 * of day: sunny forest by default, overcast, gentle rain, warm dusk at golden
 * hour, and a moonlit night scene. This is driven by:
 *   - WeatherWidget.tsx  — collapses Open-Meteo codes into mood buckets, adds a
 *                          golden-hour "dusk" override, broadcasts `kiwi:weather`.
 *   - RainOverlay.tsx    — maps each mood to a scene + accent, sets `data-rscene`
 *                          on <html> and retints `--scene-accent`.
 *   - index.css          — one `data-rscene` background block per scene photo.
 *
 * These string-level assertions lock the wiring so a refactor can't silently
 * drop a scene, the dusk override, or the accent retint.
 */

const CLIENT = join(__dirname, "..", "client", "src");
const rainOverlay = readFileSync(join(CLIENT, "components", "RainOverlay.tsx"), "utf8");
const weatherWidget = readFileSync(join(CLIENT, "components", "WeatherWidget.tsx"), "utf8");
const indexCss = readFileSync(join(CLIENT, "index.css"), "utf8");

const SCENES = ["overcast", "rain", "dusk", "night"] as const;

describe("scene-adaptive background — RainOverlay wiring", () => {
  it("sets data-rscene on <html> off the weather summary", () => {
    expect(rainOverlay).toMatch(/setAttribute\(\s*["']data-rscene["']/);
    // sunny/forest is the default and must CLEAR the attribute (no stale scene).
    expect(rainOverlay).toMatch(/removeAttribute\(\s*["']data-rscene["']/);
  });

  it("retints the glass scene accent when the mood changes", () => {
    expect(rainOverlay).toContain('setProperty("--scene-accent"');
    expect(rainOverlay).toContain('setProperty("--scene-accent-2"');
  });

  it("maps every weather summary (incl. dusk) to a shipped scene", () => {
    for (const mood of ["sunny", "cloudy", "fog", "rain", "storm", "snow", "night", "dusk"]) {
      expect(rainOverlay).toMatch(new RegExp(`${mood}:\\s*["'](forest|overcast|rain|dusk|night)["']`));
    }
  });

  it("still triggers falling rain for rain + storm", () => {
    expect(rainOverlay).toMatch(/summary === "rain"|summary === "storm"/);
  });
});

describe("scene-adaptive background — WeatherWidget golden-hour dusk", () => {
  it("adds a dusk bucket to the weather summary union", () => {
    expect(weatherWidget).toMatch(/"night"\s*\|\s*"dusk"/);
  });

  it("promotes a clear early-evening sky to the dusk scene", () => {
    expect(weatherWidget).toMatch(/hr >= 17 && hr < 20/);
    expect(weatherWidget).toMatch(/d\.summary = "dusk"/);
  });

  it("broadcasts weather on the shared kiwi:weather bus", () => {
    expect(weatherWidget).toContain('new CustomEvent("kiwi:weather"');
  });
});

describe("scene-adaptive background — index.css scene photos", () => {
  // Redesign (Katy, 2026-07-01): the background is now a SINGLE vibrant photo
  // painted on a FIXED full-viewport ::before layer (so it always covers tall/
  // scrolled pages instead of washing out to a flat gradient). The weather /
  // time-of-day engine still swaps the mood by retinting a per-scene SCRIM.
  it("paints the scene on a fixed full-viewport layer that always covers the page", () => {
    expect(indexCss).toMatch(/html\[data-rtheme="glass"\]::before/);
    expect(indexCss).toMatch(/position:\s*fixed/);
    expect(indexCss).toMatch(/inset:\s*0/);
    expect(indexCss).toContain("--scene-bg");
  });

  it("defines a per-scene mood (scrim tint) for each swapped scene", () => {
    for (const scene of SCENES) {
      expect(indexCss).toMatch(
        new RegExp(`html\\[data-rtheme="glass"\\]\\[data-rscene="${scene}"\\]`)
      );
    }
  });

  it("uses a vibrant default photo and animates the mood swap", () => {
    expect(indexCss).toContain("glass-bg-vibrant-desktop");
    expect(indexCss).toMatch(/transition:\s*background-image/);
    expect(indexCss).toMatch(/filter:\s*saturate\(/);
  });
});
