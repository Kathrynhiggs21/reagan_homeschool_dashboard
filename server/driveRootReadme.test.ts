/**
 * v2.39 (2026-05-18) — Lock the top-level Drive README slice (todo line 116).
 *
 * Two-layer coverage:
 *   - PURE: buildDriveReadme(...) and buildDriveReadmeFromCanonical(...)
 *     produce a stable, fully-formed Markdown doc with all 9 Hub roots,
 *     all canonical subfolders, the three house rules, and the common-files
 *     table.
 *   - SOURCE-PATTERN: routers.ts wires `drive.refreshRootReadme` as a
 *     familyAdminProcedure that lazy-imports `enqueueDriveRootReadme`,
 *     and `_lib/driveReadme.ts` enqueues into `drivePushQueue` with
 *     `targetFolder='reagan'`, `fileName='README.md'`, idempotent on exact
 *     contentText match. No DB, no servers — just disk reads.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CANONICAL_DRIVE_HUBS,
  buildDriveReadme,
  buildDriveReadmeFromCanonical,
} from "./_lib/driveReadme";

const ROUTERS_PATH = path.resolve(__dirname, "routers.ts");
const README_LIB_PATH = path.resolve(__dirname, "_lib/driveReadme.ts");

describe("v2.39 — Drive root README slice", () => {
  it("CANONICAL_DRIVE_HUBS exposes 9 top-level Hub roots in canonical order", () => {
    const names = CANONICAL_DRIVE_HUBS.map((h) => h.name);
    expect(names).toEqual([
      "Daily Operations",
      "Assignments and Work",
      "Curriculum and Standards",
      "Progress and Reports",
      "Adventures and Enrichment",
      "Admin and Homeschool Records",
      "Printables and Resources",
      "Inbox (Unsorted)",
      "Todo",
    ]);
    // Each hub has at least one canonical subfolder.
    for (const hub of CANONICAL_DRIVE_HUBS) {
      expect(hub.subfolders.length).toBeGreaterThan(0);
      expect(hub.appSettingKey.startsWith("drive.folder.")).toBe(true);
    }
  });

  it("buildDriveReadme renders the generated-at line, all 9 Hub roots, and all canonical subfolders", () => {
    const md = buildDriveReadme({
      generatedAtISO: "2026-05-18",
      hubFolders: CANONICAL_DRIVE_HUBS,
      dashboardUrl: "https://reagan.example.com",
    });
    expect(md).toMatch(/Reagan's Homeschool Drive — Folder Map/);
    expect(md).toMatch(/Last regenerated: 2026-05-18/);
    expect(md).toMatch(/Dashboard:.*reagan\.example\.com/);

    for (const hub of CANONICAL_DRIVE_HUBS) {
      expect(md).toContain(`### ${hub.name}`);
      for (const sub of hub.subfolders) {
        expect(md).toContain(`${hub.name} / ${sub}`);
      }
    }

    // House rules are surfaced.
    expect(md).toMatch(/Never number folders/);
    expect(md).toMatch(/Instructional \/ how-to docs auto-update/);
    expect(md).toMatch(/Trash policy/);

    // Common-files table mentions the four canonical Drive paths.
    expect(md).toContain("Day Logs / {YYYY-MM} / {date} - Day Log.md");
    expect(md).toContain(
      "Daily Agenda PDFs / {YYYY-MM} / {date} - Agenda.pdf",
    );
    expect(md).toContain(
      "Recap Replies / {YYYY-MM} / {date} - {sender} - Recap.md",
    );
    expect(md).toContain(
      "Topics Covered / {YYYY-MM} / {date} - {subject} - {topic}.md",
    );
  });

  it("buildDriveReadmeFromCanonical is deterministic for the same inputs", () => {
    const a = buildDriveReadmeFromCanonical("2026-05-18", "https://x");
    const b = buildDriveReadmeFromCanonical("2026-05-18", "https://x");
    expect(a).toEqual(b);
    // Byte-stable so the idempotency check on contentText match holds.
    const bytes = new TextEncoder().encode(a).length;
    expect(bytes).toBeGreaterThan(1500);
  });

  it("_lib/driveReadme.ts wires the enqueue helper to drivePushQueue with the right targetFolder + fileName + idempotency", () => {
    const src = fs.readFileSync(README_LIB_PATH, "utf8");
    expect(src).toMatch(/export async function enqueueDriveRootReadme/);
    expect(src).toMatch(/README_FILENAME = "README.md"/);
    expect(src).toMatch(/README_TARGET_FOLDER = "reagan" as const/);
    expect(src).toMatch(/README_TARGET_SUBPATH: string \| null = null/);
    // Lazy imports so we dodge circular deps with db.ts.
    expect(src).toMatch(/await Promise\.all\(\[\s*import\("\.\.\/db"\)/);
    // Idempotency: existing pending row with same contentText → no insert.
    expect(src).toMatch(/some\(\(row: any\) => row\?.contentText === md\)/);
    // Insert path uses the right values.
    expect(src).toMatch(/targetFolder: README_TARGET_FOLDER/);
    expect(src).toMatch(/fileName: README_FILENAME/);
    expect(src).toMatch(/mimeType: "text\/markdown"/);
    expect(src).toMatch(/contentText: md,/);
    expect(src).toMatch(/status: "pending"/);
  });

  it("routers.ts wires drive.refreshRootReadme as a familyAdminProcedure with optional dashboardUrl + generatedAtISO", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    // Mutation is registered.
    expect(src).toMatch(/refreshRootReadme: familyAdminProcedure/);
    // Lazy-imports the helper.
    expect(src).toMatch(
      /import\(\s*"\.\/_lib\/driveReadme"\s*\)/,
    );
    // Forwards both optional inputs.
    expect(src).toMatch(/dashboardUrl: input\?\.dashboardUrl/);
    expect(src).toMatch(/generatedAtISO: input\?\.generatedAtISO/);
    // Lives inside the drive: router({ ... }) block.
    const driveBlock = src.slice(
      src.indexOf("drive: router({"),
      src.indexOf("classroom: router({"),
    );
    expect(driveBlock).toContain("refreshRootReadme: familyAdminProcedure");
  });

  it("no fallback wired with publicProcedure or protectedProcedure (must be familyAdmin only)", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    expect(src).not.toMatch(/refreshRootReadme: publicProcedure/);
    expect(src).not.toMatch(/refreshRootReadme: protectedProcedure/);
    expect(src).not.toMatch(/refreshRootReadme: adminProcedure/);
  });
});
