/**
 * Shared PDF brand kit — the single source of truth for the colorful
 * "Summer Adventure" look used by BOTH the daily agenda packet
 * (agendaPdf.ts) and the per-worksheet renderer (worksheetPdf.ts).
 *
 * Exposes:
 *   - brand asset loading (Kiwi mascot logo + Fredoka/Nunito TTF fonts)
 *   - the shared palette + per-subject themes
 *   - vector helpers (rounded rects, gradient bands, sparkles, dashed boxes)
 *   - registerBrandFonts(doc) → returns the resolved font-name map
 *
 * Everything is drawn with pdfkit vector primitives + bundled TTF fonts so it
 * renders in the Node-only deploy runtime (no system fonts required).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---- Asset discovery -------------------------------------------------------
// __dirname does not exist under prod ESM. Recover it from import.meta.url,
// falling back to the CJS global (test runner) or cwd.
let __thisDir: string;
try {
  const url = (typeof import.meta !== "undefined" && (import.meta as any)?.url) || null;
  __thisDir = url ? dirname(fileURLToPath(url)) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());
} catch {
  __thisDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
}
// Resolve brand assets robustly across BOTH runtimes:
//  - dev / vitest: source file lives in server/_lib, cwd = repo root
//  - prod: esbuild bundle lives in dist/index.js, cwd is NOT guaranteed to be
//    the repo root on the autoscale runtime. The build step copies
//    server/_assets -> dist/_assets so the bundle-local candidate always hits.
// We list candidates relative to the bundle/source dir (walking up a few
// levels) first, then cwd-based fallbacks last.
const ASSET_CANDIDATES = [
  join(__thisDir, "_assets"),                  // dist/_assets (prod, copied by build) or server/_lib/_assets
  join(__thisDir, "..", "_assets"),            // dist/../_assets or server/_assets (dev/vitest)
  join(__thisDir, "..", "server", "_assets"), // dist/../server/_assets
  join(__thisDir, "..", "..", "_assets"),     // one more level up
  join(__thisDir, "..", "..", "server", "_assets"),
  join(process.cwd(), "server", "_assets"),    // cwd=repo root
  join(process.cwd(), "dist", "_assets"),      // cwd=repo root, bundle-local copy
  join(process.cwd(), "_assets"),
];
export function assetPath(name: string): string | null {
  for (const dir of ASSET_CANDIDATES) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

let _kiwiLogo: Buffer | null | undefined = undefined;
export function loadKiwiLogo(): Buffer | null {
  if (_kiwiLogo === undefined) {
    const lp = assetPath("kiwi_logo.png");
    _kiwiLogo = lp ? (() => { try { return readFileSync(lp); } catch { return null; } })() : null;
  }
  return _kiwiLogo;
}

export type BrandFonts = {
  ok: boolean;
  title: string;   // display / hero
  display: string; // secondary display
  h: string;       // headings
  body: string;    // body
  bodyB: string;   // body bold
  it: string;      // italic-ish
};

/** Register the bundled TTF fonts on a doc and return the resolved name map.
 *  Falls back to the PDF standard fonts when the TTFs are missing. */
export function registerBrandFonts(doc: PDFKit.PDFDocument): BrandFonts {
  const map: Array<[string, string]> = [
    ["Fredoka-SemiBold", "Fredoka-SemiBold.ttf"],
    ["Fredoka-Medium", "Fredoka-Medium.ttf"],
    ["Nunito", "Nunito-Regular.ttf"],
    ["Nunito-Bold", "Nunito-Bold.ttf"],
    ["Nunito-ExtraBold", "Nunito-ExtraBold.ttf"],
  ];
  let ok = true;
  try {
    for (const [name, file] of map) {
      const fp = assetPath(file);
      if (fp) doc.registerFont(name, fp); else ok = false;
    }
  } catch {
    ok = false;
  }
  if (ok) {
    return {
      ok: true,
      title: "Fredoka-SemiBold",
      display: "Fredoka-Medium",
      h: "Nunito-ExtraBold",
      body: "Nunito",
      bodyB: "Nunito-Bold",
      it: "Nunito",
    };
  }
  return {
    ok: false,
    title: "Times-Bold",
    display: "Helvetica-Bold",
    h: "Helvetica-Bold",
    body: "Helvetica",
    bodyB: "Helvetica-Bold",
    it: "Helvetica-Oblique",
  };
}

// ---- Palette ---------------------------------------------------------------
export const INK = "#27303f";
export const INK_SOFT = "#5b6472";
export const RULE = "#d6dbe4";
export const LINE = "#9aa3b2";

// ---- Subject themes (color per subject) ------------------------------------
export type Theme = {
  tag: string;
  g1: string;       // banner gradient start
  g2: string;       // banner gradient end
  accent: string;   // pill / chip / heading color
  boxFill: string;  // answer-box soft fill
  boxStroke: string;// answer-box / bubble stroke
  footer: string;   // footer pill fill
};
export const THEMES: Record<string, Theme> = {
  math: { tag: "MATH", g1: "#5b6ef0", g2: "#8b5cf6", accent: "#6d28d9", boxFill: "#eef0ff", boxStroke: "#b9c0f7", footer: "#dfe4ff" },
  ela: { tag: "ELA", g1: "#fb7a4b", g2: "#f4538a", accent: "#c2410c", boxFill: "#fff0e8", boxStroke: "#f6b79a", footer: "#ffe6d8" },
  reading: { tag: "READING", g1: "#fb7a4b", g2: "#f4538a", accent: "#c2410c", boxFill: "#fff0e8", boxStroke: "#f6b79a", footer: "#ffe6d8" },
  writing: { tag: "WRITING", g1: "#fb7a4b", g2: "#f4538a", accent: "#c2410c", boxFill: "#fff0e8", boxStroke: "#f6b79a", footer: "#ffe6d8" },
  language: { tag: "ELA", g1: "#fb7a4b", g2: "#f4538a", accent: "#c2410c", boxFill: "#fff0e8", boxStroke: "#f6b79a", footer: "#ffe6d8" },
  science: { tag: "SCIENCE", g1: "#34d399", g2: "#0ea5b7", accent: "#0f766e", boxFill: "#e7f8f1", boxStroke: "#9fe3cd", footer: "#d8f6ec" },
  social: { tag: "SOCIAL", g1: "#38bdf8", g2: "#4f7ff5", accent: "#1d4ed8", boxFill: "#e8f2ff", boxStroke: "#a8cdf6", footer: "#dcecff" },
  history: { tag: "HISTORY", g1: "#38bdf8", g2: "#4f7ff5", accent: "#1d4ed8", boxFill: "#e8f2ff", boxStroke: "#a8cdf6", footer: "#dcecff" },
  geography: { tag: "GEOGRAPHY", g1: "#38bdf8", g2: "#4f7ff5", accent: "#1d4ed8", boxFill: "#e8f2ff", boxStroke: "#a8cdf6", footer: "#dcecff" },
  bible: { tag: "BIBLE", g1: "#f59e0b", g2: "#f0598a", accent: "#b45309", boxFill: "#fff3df", boxStroke: "#f3cd86", footer: "#ffeecb" },
};
export const DEFAULT_THEME: Theme = { tag: "LEARN", g1: "#2dd4bf", g2: "#3b82f6", accent: "#0f766e", boxFill: "#e7f6f4", boxStroke: "#9bdcd3", footer: "#d9f3ef" };
/** Brand "cream" used for the agenda's overall hero accents. */
export const BRAND_HERO: Theme = { tag: "TODAY", g1: "#34d399", g2: "#0ea5b7", accent: "#0f766e", boxFill: "#eafff6", boxStroke: "#a7e8d2", footer: "#d8f6ec" };

export function themeFor(slug?: string | null): Theme {
  if (!slug) return DEFAULT_THEME;
  const s = slug.toLowerCase();
  for (const key of Object.keys(THEMES)) if (s.includes(key)) return THEMES[key];
  return DEFAULT_THEME;
}

// ---- Vector helpers --------------------------------------------------------
export function rrect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1) {
  doc.save();
  doc.roundedRect(x, y, w, h, r);
  if (fill && stroke) doc.lineWidth(lw).fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else if (stroke) doc.lineWidth(lw).stroke(stroke);
  doc.restore();
}

/** Horizontal linear-gradient fill inside a rounded rect. */
export function gradientRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, c1: string, c2: string) {
  doc.save();
  const grad = doc.linearGradient(x, y, x + w, y);
  grad.stop(0, c1).stop(1, c2);
  doc.roundedRect(x, y, w, h, r).fill(grad);
  doc.restore();
}

/** Draw a small 4-point sparkle star. */
export function sparkle(doc: PDFKit.PDFDocument, cx: number, cy: number, s: number, color: string, opacity = 0.85) {
  doc.save().opacity(opacity).fillColor(color);
  doc.moveTo(cx, cy - s)
    .lineTo(cx + s * 0.28, cy - s * 0.28)
    .lineTo(cx + s, cy)
    .lineTo(cx + s * 0.28, cy + s * 0.28)
    .lineTo(cx, cy + s)
    .lineTo(cx - s * 0.28, cy + s * 0.28)
    .lineTo(cx - s, cy)
    .lineTo(cx - s * 0.28, cy - s * 0.28)
    .closePath().fill();
  doc.restore();
}

/** Dashed rounded rectangle (for the Name/Date box). */
export function dashedRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
  doc.save().lineWidth(lw).strokeColor(color).dash(3, { space: 2 }).roundedRect(x, y, w, h, r).stroke().undash().restore();
}
