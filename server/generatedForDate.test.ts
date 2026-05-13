import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const MATCH = readFileSync(join(ROOT, "server/_lib/blockGeneratorMatch.ts"), "utf-8");
const ROUTERS = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");
const HINT = readFileSync(
  join(ROOT, "client/src/components/GeneratedBlockHint.tsx"),
  "utf-8",
);
const TODAY = readFileSync(join(ROOT, "client/src/pages/Today.tsx"), "utf-8");
const ASSEMBLER = readFileSync(
  join(ROOT, "server/_lib/agendaAssembler.ts"),
  "utf-8",
);

describe("Push 75 — generated payloads on Today", () => {
  it("blockGeneratorMatch is a pure helper (no db/io imports)", () => {
    expect(MATCH).not.toMatch(/from "\.\.\/db"/);
    expect(MATCH).toContain("deriveGeneratedForBlock");
  });

  it("deriveGeneratedForBlock skips blocks that already have a description", () => {
    expect(MATCH).toMatch(
      /block\.description && block\.description\.trim\(\)\.length > 0/,
    );
  });

  it("agendaAssembler uses the shared helper (no duplicate matching logic)", () => {
    expect(ASSEMBLER).toContain('import { deriveGeneratedForBlock } from "./blockGeneratorMatch";');
    expect(ASSEMBLER).not.toMatch(/function safeGenerate/);
    expect(ASSEMBLER).not.toMatch(/function matchOwnedBookSlug/);
  });

  it("tRPC procedure curriculum.generatedForDate is registered", () => {
    expect(ROUTERS).toMatch(/generatedForDate:\s*protectedProcedure/);
    expect(ROUTERS).toContain('deriveGeneratedForBlock');
    expect(ROUTERS).toContain('byBlockId');
  });

  it("tRPC procedure validates YYYY-MM-DD date input", () => {
    expect(ROUTERS).toMatch(/date: z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\\?\$\/\)/);
  });

  it("Today hint component self-hides when block has pageRefs or description", () => {
    expect(HINT).toContain("hasPageRefs");
    expect(HINT).toContain("hasDescription");
    expect(HINT).toMatch(/if \(hasPageRefs \|\| hasDescription\) return null/);
  });

  it("Today hint surfaces operable URL only when present", () => {
    expect(HINT).toMatch(/gen\.operable\?\.\s*url/);
    expect(HINT).toContain("Open ↗");
    expect(HINT).toContain('target="_blank"');
    expect(HINT).toContain('rel="noopener noreferrer"');
  });

  it("Today mounts GeneratedBlockHint inside the block row", () => {
    expect(TODAY).toContain("import GeneratedBlockHint");
    expect(TODAY).toContain("<GeneratedBlockHint");
    expect(TODAY).toContain("blockId={b.id}");
    expect(TODAY).toContain("todayDate={todayDate}");
  });

  it("query uses 60s stale time so the same date isn't refetched on every block render", () => {
    expect(HINT).toContain("staleTime: 60_000");
  });
});
