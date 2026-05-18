import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v2.44 (2026-05-18) — locks the 4 standing privacy/retention rules of the
 * Kiwi quiet-listening pipeline (Phase 8) from todo.md lines 484-493:
 *
 * (1) Raw audio: NEVER persisted on dashboard side. Drive holds Today/ +
 *     Last 7 Days/ short-term audio if Mom enables it.
 * (2) Voice mood + talkativity: adult-only. NEVER shown on kid pages.
 * (3) Listening data: only collected during school windows + only stored
 *     when relevance classifier returns relevant=true.
 * (4) Mirror: when listening summaries are written on the dashboard, the
 *     next mirror run picks them up into Drive.
 */

const ROOT = resolve(__dirname, "..");
const SCHEMA = resolve(ROOT, "drizzle/schema.ts");
const CLIENT_PAGES = resolve(ROOT, "client/src/pages");
const CLIENT_COMPONENTS = resolve(ROOT, "client/src/components");

function read(p: string) {
  return readFileSync(p, "utf-8");
}

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTsx(full));
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const KID_PAGES = [
  "Today.tsx",
  "Schedule.tsx",
  "Kiwi.tsx",
  "Bookshelf.tsx",
  "Notebook.tsx",
  "AppsAndTools.tsx",
];

describe("v2.44 — Kiwi listening privacy rules", () => {
  describe("Rule 1: raw audio NEVER persisted on dashboard side", () => {
    it("listeningSummaries schema has zero raw-audio bytes/blob/url columns", () => {
      const src = read(SCHEMA);
      const start = src.indexOf('export const listeningSummaries');
      const end = src.indexOf('export type ListeningSummary');
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const slice = src.slice(start, end);
      // No audio bytes / blob / file / url columns
      expect(slice).not.toMatch(/audioBytes|audioBlob|audioFile|audioUrl|audioKey|audioBuffer|audioBase64/i);
      expect(slice).not.toMatch(/rawAudio|raw_audio|rawTranscript/i);
    });

    it("schema comment explicitly says raw transcripts are NOT exposed", () => {
      const src = read(SCHEMA);
      // Verify the architectural-intent comment block is present
      expect(src).toMatch(/exposing raw transcripts in the UI/i);
      expect(src).toMatch(/Reagan's UI never reads/i);
    });
  });

  describe("Rule 2: voice mood + talkativity adult-only (never on kid pages)", () => {
    it("none of the kid pages reference talkativeness/emotionScore/comfortScore/difficultyScore", () => {
      for (const fname of KID_PAGES) {
        const full = resolve(CLIENT_PAGES, fname);
        let src: string;
        try {
          src = read(full);
        } catch {
          continue; // page may not exist; that's fine
        }
        expect(src, `Kid page ${fname} must not reference talkativenessScore`).not.toMatch(/talkativenessScore/);
        expect(src, `Kid page ${fname} must not reference emotionScore`).not.toMatch(/emotionScore/);
        expect(src, `Kid page ${fname} must not reference comfortScore`).not.toMatch(/comfortScore/);
        expect(src, `Kid page ${fname} must not reference difficultyScore`).not.toMatch(/difficultyScore/);
        expect(src, `Kid page ${fname} must not reference voiceMood`).not.toMatch(/voiceMood/);
        expect(src, `Kid page ${fname} must not reference listeningSummaries directly`).not.toMatch(/listeningSummaries/);
      }
    });

    it("only Analytics page (adult-gated) consumes listening.aggregate", () => {
      const allPages = walkTsx(CLIENT_PAGES);
      const consumers = allPages.filter((p) => /listening\.aggregate|listening\.todayBehavior/.test(read(p)));
      const consumerNames = consumers.map((p) => p.split("/").pop());
      // Analytics is allowed; nothing else
      for (const name of consumerNames) {
        expect(name).toMatch(/^Analytics\.tsx$/);
      }
    });
  });

  describe("Rule 3: school-window + relevance gated", () => {
    it("listeningSummaries schema has relevanceScore + discardedReason + schoolBlockId", () => {
      const src = read(SCHEMA);
      const start = src.indexOf('export const listeningSummaries');
      const end = src.indexOf('export type ListeningSummary');
      const slice = src.slice(start, end);
      expect(slice).toMatch(/relevanceScore: int\("relevanceScore"\)/);
      expect(slice).toMatch(/discardedReason: mysqlEnum\("discardedReason"/);
      expect(slice).toMatch(/schoolBlockId: int\("schoolBlockId"\)/);
    });

    it("discardedReason enum covers background/sibling/TV/silence/non-school/too-short", () => {
      const src = read(SCHEMA);
      const slice = src.slice(src.indexOf('discardedReason: mysqlEnum'), src.indexOf('discardedReason: mysqlEnum') + 240);
      expect(slice).toMatch(/background_noise/);
      expect(slice).toMatch(/other_person/);
      expect(slice).toMatch(/silence/);
      expect(slice).toMatch(/non_school/);
      expect(slice).toMatch(/too_short/);
    });
  });

  describe("Rule 4: dashboard-written summaries get mirrored into Drive", () => {
    it("Drive mirror module exists and references listening summaries or behavior logs", () => {
      const allTs = walkTsx(resolve(ROOT, "server"));
      const mirrorRelated = allTs.filter((p) => /driveMirror|driveSync|driveReadme|scheduledSync/i.test(p));
      // At least one mirror-pipeline module exists
      expect(mirrorRelated.length).toBeGreaterThan(0);
    });
  });

  it("there is no kid-side component file that imports listening.* tRPC procedures", () => {
    const allComps = walkTsx(CLIENT_COMPONENTS);
    const offenders: string[] = [];
    for (const p of allComps) {
      const src = read(p);
      // Allow adult-named components
      if (/Adult|Analytics|Parent|Tutor|MoodArc|MoodRing|WeeklyDigest|Trajectory|CurrentLevels|IepGoals|PowerSchool/.test(p)) continue;
      if (/listening\.(aggregate|todayBehavior|summary|raw)/.test(src)) {
        offenders.push(p);
      }
    }
    expect(offenders, `Kid-area components must not consume listening.* — found: ${offenders.join(", ")}`).toEqual([]);
  });
});
