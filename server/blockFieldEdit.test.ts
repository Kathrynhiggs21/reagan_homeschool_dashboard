/**
 * Push 42 — Per-field edits + tap-block inline edit.
 *
 * The router contract: trpc.blocks.update accepts a nullable description
 * so adults can clear notes from the inline editor. The UI contract:
 *
 *   - AgendaEditor's BlockRow renders an inline description input that
 *     patches via onPatch on blur.
 *   - Today.tsx wraps the block title in a button when adult is unlocked,
 *     calling setBlockEditor.
 *   - Schedule.tsx wraps the block title in a button that navigates to
 *     /agenda-editor with the date prefilled.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Per-field edits + tap-block inline edit — push 42", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const agendaSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "AgendaEditor.tsx"),
    "utf-8",
  );
  const todaySrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf-8",
  );
  const scheduleSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Schedule.tsx"),
    "utf-8",
  );

  it("blocks.update accepts a nullable description so adults can clear notes", () => {
    // Find the blocks.update procedure block and assert the description
    // field accepts null. The router has several `update:` blocks, so we
    // anchor on the curriculumTopicCode line unique to blocks.update.
    // The string occurs in two places; the second match is in blocks.update.
    const first = routersSrc.indexOf("curriculumTopicCode: z.string().min(1).max(30).nullable().optional()");
    expect(first).toBeGreaterThan(0);
    const idx = routersSrc.indexOf(
      "curriculumTopicCode: z.string().min(1).max(30).nullable().optional()",
      first + 1,
    );
    expect(idx).toBeGreaterThan(first);
    const start = Math.max(0, idx - 800);
    const slice = routersSrc.slice(start, idx + 200);
    expect(slice).toContain("description: z.string().nullable().optional()");
  });

  it("AgendaEditor BlockRow tracks description state + patches on blur", () => {
    expect(agendaSrc).toContain('const [description, setDescription] = useState<string>(block.description ?? "");');
    expect(agendaSrc).toContain('useEffect(() => { setDescription(block.description ?? ""); }, [block.description]);');
    expect(agendaSrc).toMatch(/onPatch\(\{ description: next \}\)/);
  });

  it("AgendaEditor inline description input clears to null when emptied", () => {
    const idx = agendaSrc.indexOf("Push 42 (2026-05-13) — inline description editor");
    expect(idx).toBeGreaterThan(0);
    const slice = agendaSrc.slice(idx, idx + 1000);
    expect(slice).toContain('description.trim() === "" ? null : description');
  });

  it("Today.tsx wraps the block title in a tap-edit button when unlocked", () => {
    expect(todaySrc).toMatch(/data-testid=\{`today-block-tap-edit-\$\{b\.id\}`\}/);
    const idx = todaySrc.indexOf("Push 42 (2026-05-13) — tap title to edit block");
    const slice = todaySrc.slice(idx, idx + 1500);
    expect(slice).toContain("unlocked ? (");
    expect(slice).toContain("setBlockEditor({ open: true, block: b as any })");
  });

  it("Today.tsx still renders a plain static title when adult is locked", () => {
    const idx = todaySrc.indexOf("Push 42 (2026-05-13) — tap title to edit block");
    const slice = todaySrc.slice(idx, idx + 2000);
    expect(slice).toContain(") : (");
    expect(slice).toMatch(/className="font-display font-bold leading-tight"/);
  });

  it("Schedule.tsx tap-block button deep-links into AgendaEditor with the date prefilled", () => {
    expect(scheduleSrc).toMatch(/data-testid=\{`schedule-block-tap-edit-\$\{b\.id\}`\}/);
    expect(scheduleSrc).toContain("navigate(`/agenda-editor?date=${dateStr}#block-${b.id}`)");
  });

  it("Schedule DayView pulls the navigate hook (no stray refs)", () => {
    const idx = scheduleSrc.indexOf("function DayView(");
    const slice = scheduleSrc.slice(idx, idx + 600);
    expect(slice).toContain("const [, navigate] = useLocation();");
  });
});
