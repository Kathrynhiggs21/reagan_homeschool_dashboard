/**
 * 2026-06-17 (v5) — Colorful "Summer Adventure" worksheet PDF renderer.
 *
 * Matches the look Katy approved (the bright, kid-friendly packet — NOT the
 * plain teacher handout). Each page carries:
 *   - a big rounded GRADIENT header BANNER with the grad-cap Kiwi mascot, a
 *     rounded display title + italic subtitle, sparkle stars, and a white
 *     dashed Name / Date box on the right;
 *   - a soft pale-yellow rounded INTRO ribbon (first page only);
 *   - rounded gradient PART pills per section;
 *   - rounded answer boxes, circle multiple-choice bubbles, ruled lines;
 *   - a rounded footer pill ("Reagan · Summer Adventure · keep shining!") and
 *     "Page X of N".
 *
 * COLOR PER SUBJECT (Katy): the banner gradient, PART pills, chips and footer
 * tint are all driven by the subject — Math=indigo/purple, ELA=coral,
 * Science=green, Social=blue, default=teal.
 *
 * PAGE RULE: each section/assignment starts on its OWN page; long sections flow
 * onto continuation pages. The answer key is a SEPARATE document.
 *
 * Drawn entirely with pdfkit vector primitives + bundled TTF fonts
 * (Fredoka/Nunito) so it renders in the Node-only deploy runtime.
 */
import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storagePut } from "../storage";
import { cleanForPdf } from "./agendaPdf";
import type { WorksheetContent, WorksheetItem, WorksheetSection } from "@shared/worksheetTypes";

// ---- Brand assets (fonts + mascot logo) -----------------------------------
// __dirname does not exist under prod ESM. Recover it from import.meta.url,
// falling back to the CJS global (test runner) or cwd.
let __thisDir: string;
try {
  const url = (typeof import.meta !== "undefined" && (import.meta as any)?.url) || null;
  __thisDir = url ? dirname(fileURLToPath(url)) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());
} catch {
  __thisDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
}
const ASSET_CANDIDATES = [
  join(__thisDir, "_assets"),
  join(__thisDir, "..", "_assets"),
  join(process.cwd(), "server", "_assets"),
  join(process.cwd(), "_assets"),
];
function assetPath(name: string): string | null {
  for (const dir of ASSET_CANDIDATES) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}
let BRAND_FONTS_OK = false;
let KIWI_LOGO: Buffer | null = null;
function loadBrand() {
  if (KIWI_LOGO === null) {
    const lp = assetPath("kiwi_logo.png");
    if (lp) { try { KIWI_LOGO = readFileSync(lp); } catch { /* ignore */ } }
  }
}
function registerBrandFonts(doc: PDFKit.PDFDocument) {
  try {
    const map: Array<[string, string]> = [
      ["Fredoka-SemiBold", "Fredoka-SemiBold.ttf"],
      ["Fredoka-Medium", "Fredoka-Medium.ttf"],
      ["Nunito", "Nunito-Regular.ttf"],
      ["Nunito-Bold", "Nunito-Bold.ttf"],
      ["Nunito-ExtraBold", "Nunito-ExtraBold.ttf"],
    ];
    let ok = true;
    for (const [name, file] of map) {
      const fp = assetPath(file);
      if (fp) doc.registerFont(name, fp); else ok = false;
    }
    BRAND_FONTS_OK = ok;
  } catch {
    BRAND_FONTS_OK = false;
  }
  if (BRAND_FONTS_OK) {
    F_TITLE = "Fredoka-SemiBold";
    F_DISPLAY = "Fredoka-Medium";
    F_H = "Nunito-ExtraBold";
    F_BODY = "Nunito";
    F_BODY_B = "Nunito-Bold";
    F_IT = "Nunito"; // italics simulated via oblique skew where needed; keep upright
  } else {
    F_TITLE = "Times-Bold";
    F_DISPLAY = "Helvetica-Bold";
    F_H = "Helvetica-Bold";
    F_BODY = "Helvetica";
    F_BODY_B = "Helvetica-Bold";
    F_IT = "Helvetica-Oblique";
  }
}

// ---- Page geometry ---------------------------------------------------------
const PAGE_PT = 612; // LETTER width
const MARGIN = 44;
const PAGE_W = PAGE_PT - MARGIN * 2;
const CONTENT_LEFT = MARGIN;
const CONTENT_RIGHT = MARGIN + PAGE_W;
const HEADER_BAND_INTRO = 188; // banner(84) + chip + intro ribbon space on page 1
const HEADER_BAND_NOINTRO = 150; // banner(84) + chip, no ribbon
const HEADER_BAND_CONT = 78; // smaller banner on continuation pages
const FOOTER_BAND = 40;
/** Top content margin for the FIRST page, depending on whether an intro shows. */
function firstTopMargin() { return MARGIN + (CH?.intro ? HEADER_BAND_INTRO : HEADER_BAND_NOINTRO); }

// ---- Fonts (assigned by registerBrandFonts) --------------------------------
let F_TITLE = "Times-Bold";
let F_DISPLAY = "Helvetica-Bold";
let F_H = "Helvetica-Bold";
let F_BODY = "Helvetica";
let F_BODY_B = "Helvetica-Bold";
let F_IT = "Helvetica-Oblique";

// ---- Palette ---------------------------------------------------------------
const INK = "#27303f";
const INK_SOFT = "#5b6472";
const RULE = "#d6dbe4";
const LINE = "#9aa3b2";

// ---- Subject themes (color per subject) ------------------------------------
type Theme = {
  tag: string;
  g1: string; // banner gradient start
  g2: string; // banner gradient end
  accent: string; // pill / chip / heading color
  boxFill: string; // answer-box soft fill
  boxStroke: string; // answer-box / bubble stroke
  footer: string; // footer pill fill
};
const THEMES: Record<string, Theme> = {
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
const DEFAULT_THEME: Theme = { tag: "LEARN", g1: "#2dd4bf", g2: "#3b82f6", accent: "#0f766e", boxFill: "#e7f6f4", boxStroke: "#9bdcd3", footer: "#d9f3ef" };

function themeFor(slug?: string | null): Theme {
  if (!slug) return DEFAULT_THEME;
  const s = slug.toLowerCase();
  for (const key of Object.keys(THEMES)) if (s.includes(key)) return THEMES[key];
  return DEFAULT_THEME;
}

// ===========================================================================
//  Module state for per-page chrome
// ===========================================================================
type Chrome = {
  title: string;
  subtitle: string;
  theme: Theme;
  dateLabel?: string;
  footerNote: string;
  footerPill: string;
  intro?: string;
  isKey: boolean;
};
let CH: Chrome;

// ---- Vector helpers --------------------------------------------------------
function rrect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1) {
  doc.save();
  doc.roundedRect(x, y, w, h, r);
  if (fill && stroke) doc.lineWidth(lw).fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else if (stroke) doc.lineWidth(lw).stroke(stroke);
  doc.restore();
}

/** Horizontal linear-gradient fill inside a rounded rect. */
function gradientRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, c1: string, c2: string) {
  doc.save();
  const grad = doc.linearGradient(x, y, x + w, y);
  grad.stop(0, c1).stop(1, c2);
  doc.roundedRect(x, y, w, h, r).fill(grad);
  doc.restore();
}

/** Draw a small 4-point sparkle star. */
function sparkle(doc: PDFKit.PDFDocument, cx: number, cy: number, s: number, color: string, opacity = 0.85) {
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
function dashedRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
  doc.save().lineWidth(lw).strokeColor(color).dash(3, { space: 2 }).roundedRect(x, y, w, h, r).stroke().undash().restore();
}

/** Deterministic shuffle (stable) for matching right-column. */
function stableShuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  let seed = a.length * 2654435761;
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Content cursor / paging ----------------------------------------------
function bottomLimit(doc: PDFKit.PDFDocument) {
  return doc.page.height - (MARGIN + FOOTER_BAND);
}
function flowPage(doc: PDFKit.PDFDocument) { doc.addPage(); }
function sectionPage(doc: PDFKit.PDFDocument) { doc.addPage(); }
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > bottomLimit(doc)) flowPage(doc);
}

// ===========================================================================
//  Section header (gradient PART pill) + word bank
// ===========================================================================
function renderSectionHeader(doc: PDFKit.PDFDocument, idx: number, sec: WorksheetSection, theme: Theme) {
  const heading = (sec.heading?.trim() || `Part ${idx + 1}`).toUpperCase();
  doc.font(F_H).fontSize(12.5);
  const cleanHeading = heading.replace(/^PART\s*\d+\s*/i, "").replace(/^[\s:.\u2013\u2014\-]+/, "");
  const label = cleanForPdf(`PART ${idx + 1}: ${cleanHeading}`);
  const textW = Math.min(PAGE_W - 24, doc.widthOfString(label) + 30);
  const pillH = 26;
  const y = doc.y;
  gradientRoundedRect(doc, CONTENT_LEFT, y, textW, pillH, 13, theme.g1, theme.g2);
  doc.fillColor("#ffffff").font(F_H).fontSize(12).text(label, CONTENT_LEFT + 15, y + 6, { width: textW - 24, lineBreak: false });
  doc.y = y + pillH + 6;

  if (sec.instructions) {
    doc.fillColor(INK_SOFT).font(F_IT).fontSize(9.8)
      .text(cleanForPdf(sec.instructions), CONTENT_LEFT + 2, doc.y, { width: PAGE_W - 4, oblique: BRAND_FONTS_OK ? 8 : 0 } as any);
    doc.moveDown(0.3);
  }

  if (sec.wordBank && sec.wordBank.length) {
    const words = sec.wordBank.map((w) => cleanForPdf(w)).join("        ");
    const pad = 12;
    doc.font(F_BODY).fontSize(10);
    const innerW = PAGE_W - pad * 2;
    const boxH = doc.heightOfString(words, { width: innerW }) + 28;
    ensureSpace(doc, boxH + 8);
    const y2 = doc.y;
    rrect(doc, CONTENT_LEFT, y2, PAGE_W, boxH, 10, "#fffdf3", "#f0d98a", 1.2);
    doc.fillColor(theme.accent).font(F_H).fontSize(9).text("WORD BANK", CONTENT_LEFT + pad, y2 + 8);
    doc.fillColor(INK).font(F_BODY_B).fontSize(10.5).text(words, CONTENT_LEFT + pad, y2 + 21, { width: innerW });
    doc.y = y2 + boxH + 10;
  }
}

// ---- Answer-space helpers --------------------------------------------------
function ruledLines(doc: PDFKit.PDFDocument, count: number, indent = 26) {
  for (let i = 0; i < count; i++) {
    ensureSpace(doc, 20);
    const y = doc.y + 13;
    doc.save().lineWidth(0.8).strokeColor(RULE).moveTo(CONTENT_LEFT + indent, y).lineTo(CONTENT_RIGHT, y).stroke().restore();
    doc.y = y + 5;
  }
  doc.moveDown(0.2);
}

/** A soft rounded answer box (the signature element of this style). */
function answerBox(doc: PDFKit.PDFDocument, h: number, theme: Theme, w = PAGE_W * 0.52) {
  ensureSpace(doc, h + 6);
  const y = doc.y;
  rrect(doc, CONTENT_LEFT + 26, y, w, h, 9, theme.boxFill, theme.boxStroke, 1.3);
  doc.y = y + h + 8;
}

// ===========================================================================
//  Per-item rendering
// ===========================================================================
function numLabel(doc: PDFKit.PDFDocument, n: number, theme: Theme, y: number) {
  doc.fillColor(theme.accent).font(F_H).fontSize(11.5).text(`${n})`, CONTENT_LEFT + 2, y, { width: 24, lineBreak: false });
}

function renderItem(doc: PDFKit.PDFDocument, item: WorksheetItem, n: number, theme: Theme) {
  switch (item.kind) {
    case "passage": {
      const txt = cleanForPdf(item.prompt);
      doc.font(F_BODY).fontSize(10.8);
      const h = doc.heightOfString(txt, { width: PAGE_W - 28 }) + 18;
      ensureSpace(doc, h + 6);
      const y = doc.y;
      rrect(doc, CONTENT_LEFT, y, PAGE_W, h, 10, "#fbfcff", theme.boxStroke, 1.2);
      doc.fillColor(INK).font(F_BODY).fontSize(10.8).text(txt, CONTENT_LEFT + 14, y + 9, { width: PAGE_W - 28 });
      doc.y = y + h + 8;
      return;
    }
    case "matching": {
      const pairs = item.pairs ?? [];
      ensureSpace(doc, 28 + pairs.length * 20);
      const y0 = doc.y;
      numLabel(doc, n, theme, y0);
      doc.fillColor(INK).font(F_BODY_B).fontSize(11)
        .text(cleanForPdf(item.prompt || "Draw a line from each word to its match."), CONTENT_LEFT + 26, y0, { width: PAGE_W - 30 });
      doc.moveDown(0.25);
      const rights = stableShuffle(pairs.map((p) => p.right));
      const colL = CONTENT_LEFT + 24;
      const colR = CONTENT_LEFT + PAGE_W * 0.58;
      for (let i = 0; i < pairs.length; i++) {
        ensureSpace(doc, 20);
        const y = doc.y + 2;
        doc.fillColor(theme.accent).font(F_H).fontSize(10.5).text(`${i + 1}.`, colL, y, { width: 16, lineBreak: false });
        doc.fillColor(INK).font(F_BODY).text(cleanForPdf(pairs[i].left), colL + 18, y, { width: PAGE_W * 0.4 - 40 });
        doc.save().circle(colR - 16, y + 6, 2).fill(theme.accent).restore();
        doc.fillColor(theme.accent).font(F_H).fontSize(10.5).text(`${String.fromCharCode(97 + i)}.`, colR, y, { width: 16, lineBreak: false });
        doc.fillColor(INK).font(F_BODY).text(cleanForPdf(rights[i]), colR + 18, y, { width: PAGE_W * 0.42 - 26 });
        doc.y = Math.max(doc.y, y + 16);
      }
      doc.moveDown(0.3);
      return;
    }
    case "scramble": {
      ensureSpace(doc, 26);
      const y = doc.y + 2;
      numLabel(doc, n, theme, y);
      doc.fillColor(INK).font(F_BODY_B).fontSize(12.5).text(cleanForPdf(item.prompt), CONTENT_LEFT + 26, y, { width: PAGE_W * 0.46, lineBreak: false });
      const lineY = y + 14;
      const arrowX = CONTENT_LEFT + PAGE_W * 0.54;
      const ay = y + 7;
      doc.save().lineWidth(1.3).strokeColor(theme.accent)
        .moveTo(arrowX, ay).lineTo(arrowX + 15, ay).stroke()
        .moveTo(arrowX + 15, ay).lineTo(arrowX + 10, ay - 4).stroke()
        .moveTo(arrowX + 15, ay).lineTo(arrowX + 10, ay + 4).stroke()
        .restore();
      doc.save().lineWidth(1).strokeColor(theme.boxStroke).moveTo(arrowX + 24, lineY).lineTo(CONTENT_RIGHT, lineY).stroke().restore();
      doc.y = lineY + 10;
      return;
    }
    case "fillblank": {
      ensureSpace(doc, 26);
      const y = doc.y;
      numLabel(doc, n, theme, y);
      doc.fillColor(INK).font(F_BODY).fontSize(11.5)
        .text(cleanForPdf(item.prompt), CONTENT_LEFT + 26, y, { width: PAGE_W - 30, lineGap: 4 });
      doc.moveDown(0.4);
      return;
    }
    case "mc": {
      const choices = item.choices ?? [];
      ensureSpace(doc, 30 + choices.length * 18);
      const y = doc.y;
      numLabel(doc, n, theme, y);
      doc.fillColor(INK).font(F_BODY_B).fontSize(11.5)
        .text(cleanForPdf(item.prompt), CONTENT_LEFT + 26, y, { width: PAGE_W - 30 });
      doc.moveDown(0.2);
      choices.forEach((c, i) => {
        ensureSpace(doc, 18);
        const cy = doc.y + 2;
        doc.save().lineWidth(1.4).circle(CONTENT_LEFT + 32, cy + 6, 6).stroke(theme.boxStroke).restore();
        doc.fillColor(theme.accent).font(F_H).fontSize(10).text(`${String.fromCharCode(97 + i)}`, CONTENT_LEFT + 28.5, cy + 2, { width: 9, lineBreak: false });
        doc.fillColor(INK).font(F_BODY).fontSize(11).text(cleanForPdf(c), CONTENT_LEFT + 48, cy + 1, { width: PAGE_W - 72 });
        doc.y = Math.max(doc.y, cy + 16);
      });
      doc.moveDown(0.3);
      return;
    }
    case "long":
    case "prompt": {
      ensureSpace(doc, 28);
      const y = doc.y;
      numLabel(doc, n, theme, y);
      doc.fillColor(INK).font(F_BODY_B).fontSize(11.5)
        .text(cleanForPdf(item.prompt), CONTENT_LEFT + 26, y, { width: PAGE_W - 30 });
      doc.moveDown(0.15);
      ruledLines(doc, item.lines ?? (item.kind === "prompt" ? 4 : 3));
      return;
    }
    case "short":
    default: {
      // short answer → label + a soft rounded answer box (signature look)
      ensureSpace(doc, 26);
      const y = doc.y;
      numLabel(doc, n, theme, y);
      doc.fillColor(INK).font(F_BODY_B).fontSize(11.5)
        .text(cleanForPdf(item.prompt), CONTENT_LEFT + 26, y, { width: PAGE_W - 30 });
      doc.moveDown(0.15);
      answerBox(doc, 26, theme);
      return;
    }
  }
}

// ===========================================================================
//  Page chrome — stamped ONCE PER PAGE after layout
// ===========================================================================
function stampChrome(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const theme = CH.theme;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const W = doc.page.width;
    const H = doc.page.height;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

    const isFirst = i === 0;
    const bannerH = isFirst ? 84 : 54;
    const bx = CONTENT_LEFT, by = MARGIN - 6;

    // --- gradient banner ---
    gradientRoundedRect(doc, bx, by, PAGE_W, bannerH, 16, theme.g1, theme.g2);

    // sparkles
    sparkle(doc, bx + PAGE_W * 0.46, by + 14, 4, "#ffffff", 0.9);
    sparkle(doc, bx + PAGE_W * 0.52, by + bannerH - 18, 3, "#ffffff", 0.7);
    sparkle(doc, bx + PAGE_W * 0.40, by + bannerH - 12, 2.5, "#ffffff", 0.6);

    // Kiwi mascot (left)
    const logoSize = isFirst ? 70 : 44;
    const logoY = by + (bannerH - logoSize) / 2;
    if (KIWI_LOGO) {
      try { doc.image(KIWI_LOGO, bx + 8, logoY, { fit: [logoSize, logoSize] }); } catch { /* ignore */ }
    }
    const textX = bx + (KIWI_LOGO ? logoSize + 16 : 16);

    // title + subtitle — auto-fit the title to ONE line within available width
    const titleSuffix = total > 1 && i > 0 ? "  (cont.)" : "";
    const titleStr = cleanForPdf(CH.title + titleSuffix);
    if (isFirst) {
      const availW = bx + PAGE_W - 12 - 168 - 16 - textX; // up to the Name/Date box
      let ts = 21;
      doc.font(F_TITLE);
      while (ts > 12 && doc.fontSize(ts).widthOfString(titleStr) > availW) ts -= 1;
      doc.fillColor("#ffffff").font(F_TITLE).fontSize(ts)
        .text(titleStr, textX, by + 14, { width: availW, lineBreak: false, ellipsis: true });
      doc.fillColor("#f6f0ff").font(F_DISPLAY).fontSize(10.5)
        .text(cleanForPdf(CH.subtitle), textX, by + 14 + ts + 5, { width: availW, lineBreak: false, ellipsis: true });
    } else {
      const availW = bx + PAGE_W - 12 - 168 - 16 - textX;
      let ts = 15;
      doc.font(F_TITLE);
      while (ts > 10 && doc.fontSize(ts).widthOfString(titleStr) > availW) ts -= 1;
      doc.fillColor("#ffffff").font(F_TITLE).fontSize(ts)
        .text(titleStr, textX, by + (bannerH - ts) / 2 - 2, { width: availW, lineBreak: false, ellipsis: true });
    }

    // Name / Date dashed box (right) — bigger on first page
    const ndW = 168, ndH = isFirst ? 52 : 36;
    const ndX = bx + PAGE_W - ndW - 12, ndY = by + (bannerH - ndH) / 2;
    rrect(doc, ndX, ndY, ndW, ndH, 8, "#ffffff");
    dashedRoundedRect(doc, ndX + 3, ndY + 3, ndW - 6, ndH - 6, 6, theme.accent, 1);
    doc.fillColor(INK).font(F_BODY_B).fontSize(isFirst ? 10 : 9);
    doc.text("Name:", ndX + 12, ndY + (isFirst ? 10 : 7), { lineBreak: false });
    doc.save().lineWidth(0.8).strokeColor(LINE).moveTo(ndX + 56, ndY + (isFirst ? 20 : 17)).lineTo(ndX + ndW - 12, ndY + (isFirst ? 20 : 17)).stroke().restore();
    doc.text("Date:", ndX + 12, ndY + (isFirst ? 30 : 21), { lineBreak: false });
    doc.save().lineWidth(0.8).strokeColor(LINE).moveTo(ndX + 56, ndY + (isFirst ? 40 : 31)).lineTo(ndX + ndW - 12, ndY + (isFirst ? 40 : 31)).stroke().restore();
    if (CH.dateLabel) doc.fillColor(INK_SOFT).font(F_BODY).fontSize(8).text(cleanForPdf(CH.dateLabel), ndX + 58, ndY + (isFirst ? 31 : 22), { lineBreak: false });

    // subject chip — sits just below the banner, left-aligned under the title
    if (isFirst) {
      const chipW = Math.max(54, doc.font(F_H).fontSize(8).widthOfString(theme.tag) + 22);
      const chipH = 16, chipX = bx + 14, chipY = by + bannerH + 6;
      rrect(doc, chipX, chipY, chipW, chipH, 8, theme.accent);
      doc.fillColor("#ffffff").font(F_H).fontSize(8).text(theme.tag, chipX, chipY + 4.5, { width: chipW, align: "center", lineBreak: false });
    }

    // --- intro ribbon (first page only) ---
    if (isFirst && CH.intro) {
      doc.font(F_IT).fontSize(10);
      const innerW = PAGE_W - 36;
      const txt = cleanForPdf(CH.intro);
      const rh = Math.max(30, doc.heightOfString(txt, { width: innerW }) + 16);
      const ry = by + bannerH + 28; // below the subject chip row
      rrect(doc, bx, ry, PAGE_W, rh, 12, "#fff6da", "#f3d98a", 1);
      doc.fillColor("#6b5320").font(F_IT).fontSize(10)
        .text(txt, bx + 18, ry + 8, { width: innerW, align: "center", oblique: BRAND_FONTS_OK ? 8 : 0 } as any);
    }

    // --- footer pill ---
    const pillW = 280, pillH = 22;
    const px = bx + (PAGE_W - pillW) / 2;
    const py = H - MARGIN - pillH + 2;
    rrect(doc, px, py, pillW, pillH, 11, theme.footer);
    sparkle(doc, px + 16, py + pillH / 2, 4, theme.accent, 0.9);
    doc.fillColor(theme.accent).font(F_BODY_B).fontSize(9.5)
      .text(cleanForPdf(CH.footerPill), px + 26, py + 6, { width: pillW - 36, align: "center", lineBreak: false });
    // page number bottom-right
    doc.fillColor(INK_SOFT).font(F_H).fontSize(7.5)
      .text(`Page ${i + 1} of ${total}`, CONTENT_RIGHT - 70, py + 7, { width: 70, align: "right", lineBreak: false });
    // scan reminder bottom-left (student worksheet only)
    if (!CH.isKey) {
      doc.fillColor(INK_SOFT).font(F_BODY).fontSize(7)
        .text(cleanForPdf(CH.footerNote), bx, py + 7, { width: 150, lineBreak: false, ellipsis: true });
    }
  }
}

const SCAN_REMINDER = "Done? Tap Scan & Submit in the dashboard.";

// ===========================================================================
//  Public: render student worksheet to Buffer
// ===========================================================================
export function renderWorksheetPdfBuffer(
  content: WorksheetContent,
  opts: { dateLabel?: string; footerNote?: string } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const theme = themeFor(content.subjectSlug);
      loadBrand();
      CH = {
        title: content.title || "Worksheet",
        subtitle: "Let's learn and have fun!",
        theme,
        dateLabel: opts.dateLabel,
        footerNote: opts.footerNote || SCAN_REMINDER,
        footerPill: "Reagan \u00b7 Summer Adventure \u00b7 keep shining!",
        intro: content.intro ? cleanForPdf(content.intro) : undefined,
        isKey: false,
      };
      const doc = new PDFDocument({
        size: "LETTER",
        bufferPages: true,
        margins: { top: firstTopMargin(), bottom: MARGIN + FOOTER_BAND, left: MARGIN, right: MARGIN },
      });
      // continuation pages need a smaller top margin (smaller banner)
      doc.on("pageAdded", () => { doc.x = CONTENT_LEFT; doc.y = MARGIN + HEADER_BAND_CONT; });
      registerBrandFonts(doc);
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const sections = Array.isArray(content.sections) ? content.sections : [];
      doc.x = CONTENT_LEFT;
      doc.y = firstTopMargin();

      let n = 1;
      sections.forEach((sec, si) => {
        if (si > 0) sectionPage(doc);
        if (si === 0 && content.bookRef) {
          doc.fillColor(INK_SOFT).font(F_BODY).fontSize(8.5).text(cleanForPdf(`Reference: ${content.bookRef}`), CONTENT_LEFT, doc.y, { width: PAGE_W });
          doc.moveDown(0.3);
        }
        renderSectionHeader(doc, si, sec, theme);
        const items = Array.isArray(sec.items) ? sec.items : [];
        for (const item of items) {
          renderItem(doc, item, n, theme);
          if (item.kind !== "passage") n++;
        }
      });

      stampChrome(doc);
      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}

/**
 * Render the teacher/parent ANSWER KEY as its OWN standalone document.
 */
export function renderAnswerKeyPdfBuffer(
  content: WorksheetContent,
  opts: { dateLabel?: string } = {},
): Promise<Buffer> | null {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const hasKey = sections.some((s) => (Array.isArray(s.items) ? s.items : []).some((i) => i.answer || (i.kind === "matching" && i.pairs?.length)));
  if (!hasKey) return null;
  return new Promise((resolve, reject) => {
    try {
      const theme = themeFor(content.subjectSlug);
      loadBrand();
      CH = {
        title: `${content.title || "Worksheet"} (Key)`,
        subtitle: "Teacher / parent copy",
        theme,
        dateLabel: opts.dateLabel,
        footerNote: "",
        footerPill: "Teacher copy \u00b7 keep separate from the student worksheet",
        intro: undefined,
        isKey: true,
      };
      const doc = new PDFDocument({
        size: "LETTER",
        bufferPages: true,
        margins: { top: firstTopMargin(), bottom: MARGIN + FOOTER_BAND, left: MARGIN, right: MARGIN },
      });
      doc.on("pageAdded", () => { doc.x = CONTENT_LEFT; doc.y = MARGIN + HEADER_BAND_CONT; });
      registerBrandFonts(doc);
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.x = CONTENT_LEFT; doc.y = firstTopMargin();
      let k = 1;
      sections.forEach((sec, si) => {
        ensureSpace(doc, 26);
        const hk = (sec.heading?.trim() || `Part ${si + 1}`).replace(/^PART\s*\d+\s*/i, "").replace(/^[\s:.\u2013\u2014\-]+/, "");
        const label = cleanForPdf(`PART ${si + 1}: ${hk}`);
        doc.font(F_H).fontSize(11.5);
        const w = Math.min(PAGE_W - 24, doc.widthOfString(label) + 28);
        const y = doc.y;
        gradientRoundedRect(doc, CONTENT_LEFT, y, w, 24, 12, theme.g1, theme.g2);
        doc.fillColor("#ffffff").font(F_H).fontSize(11).text(label, CONTENT_LEFT + 14, y + 6, { width: w - 22, lineBreak: false });
        doc.y = y + 30;
        for (const item of (Array.isArray(sec.items) ? sec.items : [])) {
          if (item.kind === "passage") continue;
          let ans = item.answer ?? "";
          if (!ans && item.kind === "matching" && item.pairs?.length) {
            ans = item.pairs.map((p, i) => `${i + 1}=${p.left} \u2192 ${p.right}`).join(";  ");
          }
          ensureSpace(doc, 16);
          const ky = doc.y;
          doc.fillColor(theme.accent).font(F_H).fontSize(10.5).text(`${k}.`, CONTENT_LEFT + 4, ky, { width: 20, lineBreak: false });
          doc.fillColor(INK).font(F_BODY).fontSize(10.5).text(cleanForPdf(ans || "—"), CONTENT_LEFT + 26, ky, { width: PAGE_W - 30 });
          k++;
        }
        doc.moveDown(0.5);
      });
      stampChrome(doc);
      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}

/**
 * Render + upload. Student worksheet never includes the answer key; a SEPARATE
 * answer-key PDF is stored when the worksheet has answers.
 */
export async function renderAndStoreWorksheetPdf(
  content: WorksheetContent,
  opts: { forDate: string; printableId: number; withAnswerKey?: boolean; footerNote?: string } = { forDate: "", printableId: 0 },
): Promise<{ key: string; url: string; contentHash: string; fileName: string; answerKeyKey?: string; answerKeyUrl?: string }> {
  const buf = await renderWorksheetPdfBuffer(content, {
    dateLabel: opts.forDate || undefined,
    footerNote: opts.footerNote,
  });
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const safeTitle = content.title.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40) || "worksheet";
  const fileName = `${safeTitle}_${opts.forDate || "today"}.pdf`;
  const key = `worksheets/${opts.forDate || "today"}/p${opts.printableId}_${contentHash.slice(0, 8)}.pdf`;
  const { key: storedKey, url } = await storagePut(key, buf, "application/pdf");

  let answerKeyKey: string | undefined;
  let answerKeyUrl: string | undefined;
  if (opts.withAnswerKey !== false) {
    const keyPromise = renderAnswerKeyPdfBuffer(content, { dateLabel: opts.forDate || undefined });
    if (keyPromise) {
      const keyBuf = await keyPromise;
      const keyHash = createHash("sha256").update(keyBuf).digest("hex");
      const akKey = `worksheets/${opts.forDate || "today"}/p${opts.printableId}_${keyHash.slice(0, 8)}_KEY.pdf`;
      const stored = await storagePut(akKey, keyBuf, "application/pdf");
      answerKeyKey = stored.key;
      answerKeyUrl = stored.url;
    }
  }
  return { key: storedKey, url, contentHash, fileName, answerKeyKey, answerKeyUrl };
}
