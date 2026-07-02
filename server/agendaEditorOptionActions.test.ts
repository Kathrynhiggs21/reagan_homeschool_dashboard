/**
 * Source-contract test for the per-option actions in the AI Agenda Editor UI
 * (Katy, 2026-07-02): every AI-proposed option must offer TWO explicit actions —
 * "Read / do this" (accept → add the option to the day) and "Create something
 * new" (ask the AI to invent a fresh alternative for that slot WITHOUT editing
 * the schedule). This pins the wiring so a refactor can't silently drop either
 * affordance. Pure file-content checks — no DOM/browser needed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const editorPath = join(__dirname, "..", "client", "src", "pages", "AgendaEditor.tsx");
const src = readFileSync(editorPath, "utf8");

describe("AgendaEditor — per-option Accept / Create-something-new actions", () => {
  it("keeps the accept handler (pickOption) that adds the chosen option to the day", () => {
    expect(src).toMatch(/const pickOption\s*=\s*\(opt: ChatOption\)/);
    // it must instruct the AI to add exactly that option to the current date
    expect(src).toMatch(/Add this one to \$\{date\}/);
  });

  it("adds a regenerateOption handler that asks for a fresh alternative", () => {
    expect(src).toMatch(/const regenerateOption\s*=\s*\(opt: ChatOption\)/);
    // it must explicitly tell the AI NOT to add the rejected option...
    expect(src).toMatch(/Don't add "\$\{opt\.title\}"/);
    // ...and NOT to edit the schedule yet (it should re-offer options instead)
    expect(src).toMatch(/[Dd]on't change the schedule yet/);
  });

  it("regenerate keeps the same subject + duration so the slot stays comparable", () => {
    // subject + duration are woven into the follow-up message
    expect(src).toMatch(/opt\.subjectSlug/);
    expect(src).toMatch(/opt\.durationMin/);
  });

  it("renders BOTH action buttons per option (accept + regenerate)", () => {
    expect(src).toContain('data-testid="agenda-option-accept"');
    expect(src).toContain('data-testid="agenda-option-regenerate"');
    expect(src).toMatch(/Read \/ do this/);
    expect(src).toMatch(/Create something new/);
  });

  it("wires each button to its handler", () => {
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*pickOption\(opt\)\}/);
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*regenerateOption\(opt\)\}/);
  });

  it("disables both actions while a chat request is in flight (no double-send)", () => {
    // both buttons carry disabled={chatM.isPending}
    const acceptIdx = src.indexOf('data-testid="agenda-option-accept"');
    const regenIdx = src.indexOf('data-testid="agenda-option-regenerate"');
    expect(acceptIdx).toBeGreaterThan(-1);
    expect(regenIdx).toBeGreaterThan(-1);
    // the disabled guard appears near each button
    const around = (i: number) => src.slice(Math.max(0, i - 400), i);
    expect(around(acceptIdx)).toMatch(/disabled=\{chatM\.isPending\}/);
    expect(around(regenIdx)).toMatch(/disabled=\{chatM\.isPending\}/);
  });
});
