import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Layout refinement toward the glassmorphism design intent (Katy, 2026-07-01).
 *
 * Locks three additive pieces so they cannot silently regress:
 *   1. PageTitle — a liquid-glass title bubble that pops in one-by-one.
 *   2. BudgieOverlay — a large transparent budgie softly present behind
 *      content, never over text, pointer-events:none, reduced-motion safe.
 *   3. The supporting CSS (bubble glass + budgie float + pop-in keyframes).
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const pageTitle = read("client/src/components/PageTitle.tsx");
const budgie = read("client/src/components/BudgieOverlay.tsx");
const shell = read("client/src/components/CozyShell.tsx");
const css = read("client/src/index.css");

describe("PageTitle liquid-glass bubble", () => {
  it("renders a title-bubble with pop-in animation hook", () => {
    expect(pageTitle).toContain('className="title-bubble"');
    expect(pageTitle).toContain('data-anim="pop"');
  });

  it("staggers subtitle and trailing bubbles one-by-one via animationDelay", () => {
    expect(pageTitle).toMatch(/title-subbubble/);
    expect(pageTitle).toMatch(/animationDelay/);
  });

  it("is wired into at least the Schedule, Analytics and Bookshelf pages", () => {
    for (const p of ["Schedule", "Analytics", "Bookshelf"]) {
      const src = read(`client/src/pages/${p}.tsx`);
      expect(src, `${p} should import PageTitle`).toContain(
        'from "@/components/PageTitle"',
      );
      expect(src, `${p} should render <PageTitle`).toContain("<PageTitle");
    }
  });
});

describe("BudgieOverlay large transparent budgie", () => {
  it("is aria-hidden, non-interactive, and lives in the shell", () => {
    expect(budgie).toContain('aria-hidden="true"');
    expect(budgie).toContain("budgie-overlay");
    expect(shell).toContain("<BudgieOverlay />");
    expect(shell).toContain('from "./BudgieOverlay"');
  });

  it("uses a transparent PNG source (not baked into the background photo)", () => {
    expect(budgie).toMatch(/manus-storage\/.+\.png/);
  });
});

describe("supporting glass CSS", () => {
  it("styles the budgie overlay behind content and non-interactive", () => {
    const block = css.slice(css.indexOf(".budgie-overlay {"));
    expect(block).toContain("pointer-events: none");
    expect(block).toContain("position: fixed");
    // Behind the content column (low z-index).
    expect(block).toMatch(/z-index:\s*1;/);
  });

  it("defines the float + pop-in keyframes", () => {
    expect(css).toContain("@keyframes budgie-float");
    expect(css).toContain("@keyframes title-pop");
  });

  it("gives the title bubble a real backdrop-blur glass treatment", () => {
    const block = css.slice(css.indexOf(".title-bubble {"));
    expect(block).toMatch(/backdrop-filter:\s*blur/);
    expect(block).toContain("border-radius: 999px");
  });

  it("disables motion under prefers-reduced-motion", () => {
    const rm = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
    expect(rm).toContain(".budgie-overlay { animation: none");
    expect(rm).toContain('[data-anim="pop"] { animation: none');
  });
});
