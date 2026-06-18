/**
 * Kiwi World helpers
 * ==================
 * 2026-06-17 (Katy): tree branches, swing/hammock, and dropped-snack props
 * were removed. Kiwi now only free-floats and perches on the top edge of real
 * cards on the page. This module keeps the single remaining helper, findLedges,
 * which is a pure DOM/math utility (no React) used by the perch component.
 */

export interface Ledge {
  /** Viewport x of a good landing spot (a card's top edge). */
  x: number;
  /** Viewport y of the card's top edge. */
  y: number;
  width: number;
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
