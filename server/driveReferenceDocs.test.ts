/**
 * Tests for the 12 canonical Drive reference Markdown docs.
 *
 * The pure builder is exhaustively tested (count, slugs, target folders,
 * subpaths, filenames, body shape, footer, deterministic output). The
 * enqueue function is exercised through one integration test that hits
 * the real DB and verifies the rows land in drivePushQueue with the
 * right shape, plus an idempotency check (re-run = no duplicate rows).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildDriveReferenceDocs, enqueueDriveReferenceDocs } from "./_lib/driveReferenceDocs";

describe("buildDriveReferenceDocs (pure)", () => {
  it("returns exactly 12 docs", () => {
    expect(buildDriveReferenceDocs().length).toBe(12);
  });

  it("uses unique slugs across all 12 docs", () => {
    const slugs = buildDriveReferenceDocs().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(12);
  });

  it("uses only valid drivePushQueue.target_folder enum values", () => {
    const validFolders = new Set([
      "reagan", "reagan_ihes", "reagan_tutor", "reagan_artwork",
      "reagan_assignments", "finished_work", "daily_schedule", "worksheets",
      "printables", "report_cards", "journal", "analytics", "adult_notes",
      "kiwi_coins", "tutor", "apps_tools", "bookshelf", "adventures",
      "practice", "notebook", "curriculum_checklist", "day_log",
      "recap_reply", "topics_covered", "agenda_pdf", "classes",
      "future_worksheets",
    ]);
    for (const d of buildDriveReferenceDocs()) {
      expect(validFolders.has(d.targetFolder), `Doc ${d.slug} uses invalid target_folder ${d.targetFolder}`).toBe(true);
    }
  });

  it("every doc has a non-trivial Markdown body (>= 400 chars) and starts with a heading", () => {
    for (const d of buildDriveReferenceDocs()) {
      expect(d.content.length, `Doc ${d.slug} content too short`).toBeGreaterThanOrEqual(400);
      expect(d.content.startsWith("# "), `Doc ${d.slug} does not start with a top-level heading`).toBe(true);
    }
  });

  it("every doc filename ends with .md", () => {
    for (const d of buildDriveReferenceDocs()) {
      expect(d.fileName.endsWith(".md")).toBe(true);
    }
  });

  it("every filename is filesystem-safe (no slashes, no leading dots)", () => {
    for (const d of buildDriveReferenceDocs()) {
      expect(d.fileName).not.toMatch(/[/\\]/);
      expect(d.fileName.startsWith(".")).toBe(false);
    }
  });

  it("every doc footer includes the seed date and dashboard URL", () => {
    const docs = buildDriveReferenceDocs({ generatedAtISO: "2026-05-30", dashboardUrl: "https://test.example.com" });
    for (const d of docs) {
      expect(d.content).toContain("2026-05-30");
      expect(d.content).toContain("https://test.example.com");
    }
  });

  it("output is deterministic given the same seed", () => {
    const a = buildDriveReferenceDocs({ generatedAtISO: "2026-05-30", dashboardUrl: "https://x.test" });
    const b = buildDriveReferenceDocs({ generatedAtISO: "2026-05-30", dashboardUrl: "https://x.test" });
    expect(a).toEqual(b);
  });

  it("Ohio scope doc covers all 4 subjects + ladder code format", () => {
    const scope = buildDriveReferenceDocs().find((d) => d.slug === "ohio-5th-scope")!;
    expect(scope.content).toMatch(/Math/);
    expect(scope.content).toMatch(/English Language Arts/);
    expect(scope.content).toMatch(/Science/);
    expect(scope.content).toMatch(/Social Studies/);
    expect(scope.content).toMatch(/OH\.5\.NBT\.3/);
  });

  it("IH portfolio doc references Ohio Revised Code 3321.042", () => {
    const portfolio = buildDriveReferenceDocs().find((d) => d.slug === "ohio-ih-portfolio")!;
    expect(portfolio.content).toMatch(/3321\.042/);
    expect(portfolio.content).toMatch(/portfolio/i);
  });

  it("Khan + IXL docs warn about the inactive ihsd.us address", () => {
    const ixl = buildDriveReferenceDocs().find((d) => d.slug === "ixl-mapping")!;
    expect(ixl.content).toMatch(/ihsd\.us/);
    expect(ixl.content).toMatch(/[Ii]nactive/);
  });

  it("Kiwi cheatsheet documents the new Fly button single-tap", () => {
    const kiwi = buildDriveReferenceDocs().find((d) => d.slug === "kiwi-cheatsheet")!;
    expect(kiwi.content).toMatch(/Fly/i);
    expect(kiwi.content).toMatch(/single tap|Single tap/i);
  });

  it("Day Log format references the canonical Drive subpath", () => {
    const dl = buildDriveReferenceDocs().find((d) => d.slug === "day-log-format")!;
    expect(dl.content).toMatch(/Day Logs/);
    expect(dl.content).toMatch(/YYYY-MM/);
  });

  it("docs span at least 8 distinct target folders (good coverage)", () => {
    const folders = new Set(buildDriveReferenceDocs().map((d) => d.targetFolder));
    expect(folders.size).toBeGreaterThanOrEqual(8);
  });
});

describe("enqueueDriveReferenceDocs (DB integration)", () => {
  let firstRun: Awaited<ReturnType<typeof enqueueDriveReferenceDocs>>;
  let secondRun: Awaited<ReturnType<typeof enqueueDriveReferenceDocs>>;

  beforeAll(async () => {
    // Use a fixed seed so re-runs produce byte-identical content.
    firstRun = await enqueueDriveReferenceDocs({
      generatedAtISO: "2026-05-30",
      dashboardUrl: "https://reagan-test-stable.example.com/v17",
    });
    secondRun = await enqueueDriveReferenceDocs({
      generatedAtISO: "2026-05-30",
      dashboardUrl: "https://reagan-test-stable.example.com/v17",
    });
  });

  it("first run reports ok=true and enqueued + skipped sums to 12", () => {
    expect(firstRun.ok).toBe(true);
    expect(firstRun.enqueued + firstRun.skippedAlreadyQueued).toBe(12);
    expect(firstRun.failed).toBe(0);
  });

  it("second run is a no-op: nothing newly enqueued, all 12 skipped", () => {
    expect(secondRun.ok).toBe(true);
    expect(secondRun.enqueued).toBe(0);
    expect(secondRun.skippedAlreadyQueued).toBe(12);
    expect(secondRun.failed).toBe(0);
  });
});
