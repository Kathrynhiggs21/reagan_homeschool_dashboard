/**
 * 2026-06-16 — AgendaEditor "direct-acting AI" wiring tests.
 *
 * Mom's feedback: the agenda editor felt like a confused *suggestion* bot, not
 * an AI that just talks to her and changes the schedule. The fix made the chat
 * the single primary surface, bound the mutation DIRECTLY (no optional-chain
 * fallback that silently shows "Chat not available"), and made replies speak
 * in the first person about exactly what changed.
 *
 * These are source-pattern (string-grep) tests because vitest runs in the node
 * environment (no jsdom). They lock the contract so the editor can't silently
 * regress back into the suggestion/preview model.
 *
 * Asserts:
 *  1. AgendaEditor binds the chat mutation directly: trpc.agendaEditor.chat.useMutation
 *  2. It does NOT use the brittle optional-chain binding that caused the
 *     "Chat not available" dead-end.
 *  3. sendChat no longer guards on a possibly-undefined mutation with that toast.
 *  4. A first-person reply composer exists and is used on success.
 *  5. The success handler refreshes the live schedule snapshot.
 *  6. routers.ts chat proc returns the change tally fields the UI reads.
 *  7. The server reply speaks in the first person ("I made"/"I read that").
 *  8. The system prompt tells the model it IS the editor (act, don't suggest)
 *     and how to handle videos/assignments as block content.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const EDITOR_PATH = path.join(ROOT, "client/src/pages/AgendaEditor.tsx");
const ROUTERS_PATH = path.join(ROOT, "server/routers.ts");
const BRAIN_PATH = path.join(ROOT, "server/_lib/agendaEditor.ts");

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("AgendaEditor — direct-acting AI chat wiring", () => {
  it("binds the chat mutation directly (typed, no optional chain)", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/trpc\.agendaEditor\.chat\.useMutation/);
  });

  it("does NOT use the brittle optional-chained chat binding (in code, not comments)", () => {
    const src = read(EDITOR_PATH);
    // Strip line comments so the explanatory note documenting the old
    // anti-pattern doesn't trip this guard.
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\(trpc as any\)\.agendaEditor\?\.chat\?\.useMutation/);
  });

  it("no longer dead-ends with a 'Chat not available' toast", () => {
    const src = read(EDITOR_PATH);
    expect(src).not.toMatch(/Chat not available/);
  });

  it("uses a first-person reply composer on success", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/function\s+composeFirstPersonReply/);
    expect(src).toMatch(/composeFirstPersonReply\(data\)/);
  });

  it("refreshes the live schedule snapshot after a change", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/agendaEditor\.snapshot\.invalidate\(\{\s*date\s*\}\)/);
  });

  it("guards re-entrancy on isPending instead of a missing mutation", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/chatM\.isPending/);
  });

  it("chat proc returns the change-tally fields the UI reads", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/reply,\s*inserted,\s*updated,\s*deleted,\s*reordered,\s*shifted/);
  });

  it("server reply speaks in the first person", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/I made|I read that/);
  });

  it("system prompt tells the model it IS the editor (act, don't suggest)", () => {
    const src = read(BRAIN_PATH);
    expect(src).toMatch(/You ARE the schedule editor, not a suggestion bot/);
  });

  it("system prompt covers videos/assignments as block content", () => {
    const src = read(BRAIN_PATH);
    expect(src).toMatch(/swap the science video/i);
    expect(src).toMatch(/reading assignment/i);
  });

  // 2026-06-29 — answer-any-question upgrade contract.
  it("system prompt teaches the QUESTIONS-vs-EDITS split", () => {
    const src = read(BRAIN_PATH);
    expect(src).toMatch(/QUESTIONS vs EDITS/i);
  });

  it("brain routes non-edit questions to a conversational answer", () => {
    const src = read(BRAIN_PATH);
    expect(src).toMatch(/maybeAnswerInstead/);
    expect(src).toMatch(/mode:\s*"answer"/);
  });

  it("chat proc returns a mode flag so the UI can tell answers from edits", () => {
    const src = read(ROUTERS_PATH);
    expect(src).toMatch(/mode:\s*isAnswer\s*\?\s*"answer"/);
  });

  it("editor renders answer-mode replies verbatim (no change tally)", () => {
    const src = read(EDITOR_PATH);
    expect(src).toMatch(/mode === "answer"/);
  });
});
