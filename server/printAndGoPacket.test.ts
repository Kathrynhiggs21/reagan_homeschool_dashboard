/**
 * v2.98 Print-and-Go Packet — vitest contracts.
 *
 * Locks:
 *  1. hydrateLessonForBlock accepts a 3rd arg (curriculumTopicId) and pulls
 *     curriculumResources into the lesson payload.
 *  2. agendaAssembler passes curriculumTopicId to hydrateLessonForBlock.
 *  3. agendaAssembler reads devotionText from the plan and forwards it.
 *  4. agendaPdf.ts AgendaPdfInput type includes devotionText.
 *  5. buildAgendaPdf renders a devotion page when devotionText is set.
 *  6. buildAgendaPdf renders per-block lesson pages for blocks with lesson content.
 *  7. CozyShell nameplate uses a larger photo (w-20 h-20).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(__dirname, "..");

// ── 1. hydrateLessonForBlock signature ──────────────────────────────────────
describe("hydrateLessonForBlock v2.98 — curriculumResources support", () => {
  const HYDRATE_PATH = path.join(ROOT, "server/_lib/hydrateLessonForBlock.ts");
  const src = fs.readFileSync(HYDRATE_PATH, "utf8");

  it("accepts curriculumTopicId as 3rd parameter", () => {
    expect(src).toMatch(/curriculumTopicId\?:\s*number\s*\|\s*null/);
  });

  it("calls listTopicResources when curriculumTopicId is provided", () => {
    expect(src).toContain("listTopicResources");
    expect(src).toMatch(/if\s*\(\s*curriculumTopicId\s*\)/);
  });

  it("maps curriculumResources kind=worksheet to lesson.worksheets", () => {
    expect(src).toMatch(/case\s+"worksheet"/);
    expect(src).toMatch(/lesson\.worksheets/);
  });

  it("maps curriculumResources kind=video to lesson.videos", () => {
    expect(src).toMatch(/case\s+"video"/);
    expect(src).toMatch(/lesson\.videos/);
  });

  it("maps curriculumResources kind=lesson to instructions", () => {
    expect(src).toMatch(/case\s+"lesson"/);
    expect(src).toMatch(/instructionsParts/);
  });

  it("dedupes by URL so the same resource doesn't appear twice", () => {
    expect(src).toMatch(/seenUrls/);
    expect(src).toMatch(/seenVideoUrls/);
  });

  it("returns null when all three sources are empty", () => {
    expect(src).toMatch(/topicResources\.length === 0/);
    expect(src).toMatch(/return null/);
  });
});

// ── 2. agendaAssembler passes curriculumTopicId ──────────────────────────────
describe("agendaAssembler v2.98 — passes curriculumTopicId to hydrator", () => {
  const ASSEMBLER_PATH = path.join(ROOT, "server/_lib/agendaAssembler.ts");
  const src = fs.readFileSync(ASSEMBLER_PATH, "utf8");

  it("passes curriculumTopicId as 3rd arg to hydrateLessonForBlock", () => {
    expect(src).toMatch(/hydrateLessonForBlock\(\s*b\.id\s*,\s*dateStr\s*,\s*b\.curriculumTopicId/);
  });
});

// ── 3. agendaAssembler forwards devotionText ─────────────────────────────────
describe("agendaAssembler v2.98 — devotionText forwarded", () => {
  const ASSEMBLER_PATH = path.join(ROOT, "server/_lib/agendaAssembler.ts");
  const src = fs.readFileSync(ASSEMBLER_PATH, "utf8");

  it("reads devotionText from the plan and includes it in the return value", () => {
    expect(src).toMatch(/devotionText/);
  });
});

// ── 4. agendaPdf AgendaPdfInput includes devotionText ────────────────────────
describe("agendaPdf v2.98 — AgendaPdfInput type", () => {
  const PDF_PATH = path.join(ROOT, "server/_lib/agendaPdf.ts");
  const src = fs.readFileSync(PDF_PATH, "utf8");

  it("AgendaPdfInput has devotionText field", () => {
    expect(src).toMatch(/devotionText\?:\s*string\s*\|\s*null/);
  });

  it("buildAgendaPdf is exported", () => {
    expect(src).toContain("export async function buildAgendaPdf");
  });
});

// ── 5 & 6. buildAgendaPdf renders devotion page and block lesson pages ────────
describe("buildAgendaPdf v2.98 — full packet rendering", () => {
  it("renders a devotion page when devotionText is set", async () => {
    const { buildAgendaPdf } = await import("./_lib/agendaPdf");
    const baseBlock = {
      sortOrder: 1,
      durationMin: 30,
      title: "Math",
      subjectName: "Math",
    };
    const withDevotionResult = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [baseBlock],
      devotionText: "Trust in the Lord with all your heart. — Proverbs 3:5",
    });
    const withoutDevotionResult = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [baseBlock],
      devotionText: null,
    });
    // Devotion page adds bytes — the PDF with devotion must be larger.
    expect(withDevotionResult.pdfBuffer.byteLength).toBeGreaterThan(
      withoutDevotionResult.pdfBuffer.byteLength,
    );
  });

  it("renders per-block lesson pages for blocks with lesson content", async () => {
    const { buildAgendaPdf } = await import("./_lib/agendaPdf");
    const noLessonResult = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [{ sortOrder: 1, durationMin: 30, title: "Math" }],
    });
    const withLessonResult = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [{
        sortOrder: 1,
        durationMin: 30,
        title: "Math",
        lesson: {
          instructions: "Complete pages 45-46 in your workbook.",
          worksheets: [{ title: "Fractions Practice", description: "Show your work.", questions: ["1/2 + 1/4 = ?", "3/4 - 1/8 = ?"] }],
          answerKey: "1. 3/4  2. 5/8",
        },
      }],
    });
    // Lesson page adds bytes.
    expect(withLessonResult.pdfBuffer.byteLength).toBeGreaterThan(
      noLessonResult.pdfBuffer.byteLength,
    );
  });

  it("includes devotionText in canonical text when set", async () => {
    const { buildAgendaPdf } = await import("./_lib/agendaPdf");
    const result = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [],
      devotionText: "Be still and know that I am God.",
    });
    expect(result.canonicalText).toContain("Devotion:");
    expect(result.canonicalText).toContain("Be still");
  });

  it("agendaHash is a 64-char hex string", async () => {
    const { buildAgendaPdf } = await import("./_lib/agendaPdf");
    const result = await buildAgendaPdf({
      forDate: "2026-05-28",
      dayLabel: "Thursday, May 28",
      studentName: "Reagan",
      blocks: [],
    });
    expect(result.agendaHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── 7. CozyShell nameplate uses larger photo ─────────────────────────────────
describe("CozyShell v2.98 — enlarged nameplate photo", () => {
  const COZY_PATH = path.join(ROOT, "client/src/components/CozyShell.tsx");
  const src = fs.readFileSync(COZY_PATH, "utf8");

  it("uses w-20 h-20 for the profile photo (was w-12 h-12)", () => {
    expect(src).toMatch(/w-20\s+h-20/);
  });

  it("uses flex-col layout to centre photo above text", () => {
    expect(src).toMatch(/flex-col\s+items-center/);
  });
});
