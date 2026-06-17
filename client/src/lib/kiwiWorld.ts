/**
 * Kiwi World helpers (2026-06-17, Katy request)
 * =============================================
 * Gives Kiwi a little environment to live in instead of only free-floating:
 *  - tree branches that poke in from the edges of the page (top/left/right)
 *  - "ledges": the top edges of real cards on the page she can stand on
 *  - dropped snacks (a fry, a berry) that fall from a branch for her to eat
 *
 * These are pure DOM/math helpers (no React) so they're easy to reuse and the
 * timer/animation logic stays in the perch component. Everything degrades
 * gracefully: if no cards are found she just uses branches or the floor.
 */

export type BranchSide = "top" | "left" | "right";

export interface Branch {
  id: string;
  side: BranchSide;
  /** Viewport pixel coords of the perchable tip of the branch. */
  x: number;
  y: number;
  /** Branch length in px (for drawing). */
  length: number;
  /** Whether this branch hosts a swing / hammock. */
  fixture: "none" | "swing" | "hammock";
}

export interface Ledge {
  /** Viewport x of a good landing spot (a card's top edge). */
  x: number;
  /** Viewport y of the card's top edge. */
  y: number;
  width: number;
}

/**
 * Build a small, stable set of branches anchored to the page edges. We seed
 * positions from the viewport size so they sit at pleasant spots and don't
 * overlap typical content. Returned in viewport coords.
 */
export function computeBranches(
  vw: number = typeof window !== "undefined" ? window.innerWidth : 1024,
  vh: number = typeof window !== "undefined" ? window.innerHeight : 768,
): Branch[] {
  const len = Math.min(160, Math.max(90, Math.round(vw * 0.12)));
  return [
    // Top-left branch poking down
    { id: "b-topleft", side: "top", x: Math.round(vw * 0.16), y: 8, length: len, fixture: "none" },
    // Top-right branch with a swing
    { id: "b-topright", side: "top", x: Math.round(vw * 0.82), y: 8, length: len, fixture: "swing" },
    // Left-side branch with a hammock
    { id: "b-left", side: "left", x: 8, y: Math.round(vh * 0.42), length: len, fixture: "hammock" },
    // Right-side branch
    { id: "b-right", side: "right", x: vw - 8, y: Math.round(vh * 0.6), length: len, fixture: "none" },
  ];
}

/**
 * Scan the page for card-like elements and return the top-edge "ledges" Kiwi
 * can stand on. We look for elements tagged `[data-kiwi-ledge]` first (explicit
 * opt-in), then fall back to common card classes. Results are filtered to those
 * currently visible in the viewport and de-duplicated by rounded position.
 */
export function findLedges(maxCount = 8): Ledge[] {
  if (typeof document === "undefined") return [];
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const selectors = [
    "[data-kiwi-ledge]",
    ".rounded-xl.border",
    ".rounded-2xl.border",
    "[class*='rounded-'][class*='border']",
  ];
  const seen = new Set<string>();
  const out: Ledge[] = [];
  for (const sel of selectors) {
    let nodes: Element[] = [];
    try { nodes = Array.from(document.querySelectorAll(sel)); } catch { nodes = []; }
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      // Reasonable card size + on-screen + not tiny.
      if (r.width < 120 || r.height < 60) continue;
      if (r.top < 60 || r.top > vh - 80) continue;
      if (r.left < 0 || r.right > vw) continue;
      const key = `${Math.round(r.left / 24)}:${Math.round(r.top / 24)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x: Math.round(r.left + r.width * 0.5), y: Math.round(r.top), width: Math.round(r.width) });
      if (out.length >= maxCount) return out;
    }
    if (out.length >= maxCount) break;
  }
  return out;
}

/** Snack glyphs that can fall from a branch. */
export const SNACK_GLYPHS = ["\u{1F35F}", "\u{1F353}", "\u{1FAD0}", "\u{1F34E}", "\u{1F955}"]; // fries, strawberry, blueberries, apple, carrot

export interface FallingSnack {
  id: number;
  glyph: string;
  /** Branch the snack falls from. */
  fromX: number;
  fromY: number;
  /** Where it lands (a perch/floor y). */
  landX: number;
  landY: number;
}

let snackSeq = 1;
export function makeFallingSnack(branch: Branch, landY: number): FallingSnack {
  const glyph = SNACK_GLYPHS[Math.floor(Math.random() * SNACK_GLYPHS.length)]!;
  return {
    id: snackSeq++,
    glyph,
    fromX: branch.x,
    fromY: branch.y + branch.length * 0.6,
    landX: branch.x + (Math.random() - 0.5) * 40,
    landY,
  };
}
