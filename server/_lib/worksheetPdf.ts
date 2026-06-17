/**
 * 2026-06-17 — Colorful, illustrated worksheet PDF renderer (v2).
 *
 * Turns a `WorksheetContent` (the same structure Reagan fills in online) into a
 * bright, kid-friendly printable that matches the reference worksheets Katy
 * shared: a colored title banner with a friendly pencil mascot + confetti, a
 * Name/Date box, per-section colored header "pills" sitting on matching
 * bordered cards, themed answer boxes / multiple-choice bubbles, a
 * "Skills Covered" footer ribbon, and an encouraging mascot footer.
 *
 * PAGE LAYOUT RULE (Katy, 2026-06-17): each *section* (a block's assignment /
 * worksheet) starts on its OWN page. A long section simply flows onto extra
 * pages — but two different sections never share a page. The optional answer
 * key always lands on its own fresh page(s) at the end.
 *
 * Everything is drawn with pdfkit vector primitives (rounded rects, fills,
 * text, simple drawn shapes) so it renders in the Node-only deploy runtime
 * with no headless browser / rasterizer dependency.
 *
 * Reuses `cleanForPdf` from agendaPdf.ts so glyph handling matches the rest of
 * the printables.
 */
import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";
import { storagePut } from "../storage";
import { cleanForPdf } from "./agendaPdf";
import type { WorksheetContent, WorksheetItem } from "@shared/worksheetTypes";

// ---- Page geometry ---------------------------------------------------------
const MARGIN = 44;
const PAGE_W = 612 - MARGIN * 2; // LETTER width (612pt) minus margins => 524
const CONTENT_LEFT = MARGIN;
const CONTENT_RIGHT = MARGIN + PAGE_W;

// ---- Palette ---------------------------------------------------------------
// A rotating set of cheerful section colors (header pill bg + card border),
// mirroring the bright PART 1..N headers in the reference worksheet.
const SECTION_COLORS = [
  { pill: "#7c3aed", border: "#c4b5fd", tint: "#f5f1ff" }, // purple
  { pill: "#2563eb", border: "#bfdbfe", tint: "#eef4ff" }, // blue
  { pill: "#16a34a", border: "#bbf7d0", tint: "#eefcf2" }, // green
  { pill: "#ea580c", border: "#fed7aa", tint: "#fff4ea" }, // orange
  { pill: "#0d9488", border: "#99f6e4", tint: "#ecfdfa" }, // teal
  { pill: "#db2777", border: "#fbcfe8", tint: "#fff0f7" }, // pink
];
const INK = "#1f2640";
const INK_SOFT = "#4b5168";
const BANNER_A = "#6366f1";
const BANNER_B = "#8b5cf6";
const BOX_STROKE = "#94a3b8";
const STAR_COLORS = ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa"];

// ===========================================================================
//  Small vector helpers
// ===========================================================================
function roundedFill(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number, r: number,
  fill: string, stroke?: string, lineWidth = 1,
) {
  doc.save().roundedRect(x, y, w, h, r);
  if (stroke) doc.fillAndStroke(fill, stroke);
  else doc.fill(fill);
  if (stroke) doc.lineWidth(lineWidth);
  doc.restore();
}

/** A small 5-point star (decorative confetti). */
function star(doc: PDFKit.PDFDocument, cx: number, cy: number, R: number, color: string) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const aOut = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const aIn = aOut + Math.PI / 5;
    pts.push([cx + Math.cos(aOut) * R, cy + Math.sin(aOut) * R]);
    pts.push([cx + Math.cos(aIn) * R * 0.45, cy + Math.sin(aIn) * R * 0.45]);
  }
  doc.save().polygon(...pts).fill(color).restore();
}

/** A friendly cartoon pencil mascot (drawn), tucked into the banner. */
function pencilMascot(doc: PDFKit.PDFDocument, x: number, y: number, h: number) {
  const w = h * 0.42;
  doc.save();
  // body
  roundedFill(doc, x, y + h * 0.18, w, h * 0.66, 4, "#fbbf24");
  // tip
  doc.polygon([x, y + h * 0.84], [x + w, y + h * 0.84], [x + w / 2, y + h]).fill("#f59e0b");
  doc.polygon([x + w * 0.34, y + h * 0.95], [x + w * 0.66, y + h * 0.95], [x + w / 2, y + h]).fill("#1f2937");
  // eraser
  roundedFill(doc, x, y, w, h * 0.2, 3, "#f472b6");
  // face
  doc.circle(x + w * 0.34, y + h * 0.42, 1.7).fill("#1f2937");
  doc.circle(x + w * 0.66, y + h * 0.42, 1.7).fill("#1f2937");
  doc.save().lineWidth(1.1).strokeColor("#1f2937")
    .moveTo(x + w * 0.32, y + h * 0.54).bezierCurveTo(
      x + w * 0.42, y + h * 0.6, x + w * 0.58, y + h * 0.6, x + w * 0.68, y + h * 0.54,
    ).stroke().restore();
  doc.restore();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom - 40; // leave room for footer
  if (doc.y + needed > bottom) {
    addContentPage(doc);
  }
}

/** A faint footer strip drawn on every content page. */
function pageFooter(doc: PDFKit.PDFDocument, footerNote: string) {
  const y = doc.page.height - doc.page.margins.bottom - 18;
  doc.save();
  roundedFill(doc, CONTENT_LEFT, y, PAGE_W, 16, 8, "#eef2ff");
  star(doc, CONTENT_LEFT + 12, y + 8, 4, "#fbbf24");
  doc.fillColor(INK_SOFT).font("Helvetica-Oblique").fontSize(8)
    .text(cleanForPdf(footerNote), CONTENT_LEFT + 22, y + 4, { width: PAGE_W - 30, lineBreak: false });
  doc.restore();
}

let CURRENT_FOOTER = "Keep going — you're doing great!";
function addContentPage(doc: PDFKit.PDFDocument) {
  doc.addPage();
  doc.y = doc.page.margins.top;
  pageFooter(doc, CURRENT_FOOTER);
  doc.y = doc.page.margins.top;
}

// ===========================================================================
//  Banner / cover
// ===========================================================================
function renderBanner(
  doc: PDFKit.PDFDocument,
  content: WorksheetContent,
  opts: { dateLabel?: string },
) {
  const top = doc.page.margins.top;
  const bannerH = 70;
  // gradient-ish banner (two stacked rounded rects)
  roundedFill(doc, CONTENT_LEFT, top, PAGE_W, bannerH, 14, BANNER_A);
  roundedFill(doc, CONTENT_LEFT, top, PAGE_W, bannerH * 0.55, 14, BANNER_B);
  // confetti
  for (let i = 0; i < 7; i++) {
    star(doc, CONTENT_LEFT + 130 + i * 52, top + 12 + (i % 2) * 40, 4 + (i % 2), STAR_COLORS[i % STAR_COLORS.length]);
  }
  // mascot
  pencilMascot(doc, CONTENT_LEFT + 14, top + 8, bannerH - 16);
  // title
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text(cleanForPdf(content.title), CONTENT_LEFT + 70, top + 14, { width: PAGE_W - 200, lineBreak: true });
  doc.fillColor("#e9e6ff").font("Helvetica-Oblique").fontSize(10)
    .text("Let's learn and have fun!", CONTENT_LEFT + 70, top + 44, { width: PAGE_W - 200 });

  // Name / Date box (top-right, dashed)
  const nbW = 150, nbH = 46, nbX = CONTENT_RIGHT - nbW - 8, nbY = top + 10;
  doc.save().lineWidth(1).dash(3, { space: 2 }).roundedRect(nbX, nbY, nbW, nbH, 8).stroke("#ffffff").undash().restore();
  doc.fillColor("#ffffff").font("Helvetica").fontSize(9)
    .text("Name: ______________", nbX + 8, nbY + 9, { width: nbW - 14 })
    .text("Date: _______________", nbX + 8, nbY + 26, { width: nbW - 14 });

  doc.y = top + bannerH + 12;

  // meta + intro
  const meta: string[] = [];
  if (opts.dateLabel) meta.push(opts.dateLabel);
  if (content.bookRef) meta.push(String(content.bookRef));
  if (meta.length) {
    doc.fillColor(INK_SOFT).font("Helvetica").fontSize(9).text(cleanForPdf(meta.join("   •   ")), CONTENT_LEFT, doc.y, { width: PAGE_W });
    doc.moveDown(0.2);
  }
  if (content.intro) {
    const introY = doc.y;
    const introH = doc.heightOfString(cleanForPdf(content.intro), { width: PAGE_W - 24 }) + 14;
    roundedFill(doc, CONTENT_LEFT, introY, PAGE_W, introH, 10, "#fffbeb", "#fde68a", 1);
    doc.fillColor(INK).font("Helvetica-Oblique").fontSize(10)
      .text(cleanForPdf(content.intro), CONTENT_LEFT + 12, introY + 7, { width: PAGE_W - 24 });
    doc.y = introY + introH + 10;
  }
}

// ===========================================================================
//  Items
// ===========================================================================
function answerLines(doc: PDFKit.PDFDocument, count: number) {
  for (let i = 0; i < count; i++) {
    ensureSpace(doc, 22);
    const y = doc.y + 12;
    doc.save().strokeColor("#cbd5e1").lineWidth(0.8).dash(1.5, { space: 0 })
      .moveTo(CONTENT_LEFT + 16, y).lineTo(CONTENT_RIGHT - 8, y).stroke().undash().restore();
    doc.y = y + 6;
  }
  doc.moveDown(0.2);
}

/** A small empty answer box (for short answers / equations). */
function answerBox(doc: PDFKit.PDFDocument, atX: number, atY: number) {
  doc.save().lineWidth(1).roundedRect(atX, atY, 46, 20, 4).stroke(BOX_STROKE).restore();
}

function renderItem(doc: PDFKit.PDFDocument, item: WorksheetItem, n: number, color: typeof SECTION_COLORS[number]) {
  ensureSpace(doc, 60);
  const isPassage = item.kind === "passage";
  const label = isPassage ? "" : `${n}. `;

  if (isPassage) {
    // passage reads inside a soft tinted callout
    const txt = cleanForPdf(item.prompt);
    const h = doc.heightOfString(txt, { width: PAGE_W - 28 }) + 14;
    ensureSpace(doc, h + 8);
    const y = doc.y;
    roundedFill(doc, CONTENT_LEFT + 4, y, PAGE_W - 8, h, 8, color.tint, color.border, 1);
    doc.fillColor(INK).font("Helvetica-Oblique").fontSize(10).text(txt, CONTENT_LEFT + 16, y + 7, { width: PAGE_W - 28 });
    doc.y = y + h + 6;
    return;
  }

  // numbered prompt
  doc.fillColor(INK).font("Helvetica").fontSize(11)
    .text(`${label}${cleanForPdf(item.prompt)}`, CONTENT_LEFT + 6, doc.y, { width: PAGE_W - 60 });

  switch (item.kind) {
    case "mc":
      doc.moveDown(0.15);
      (item.choices ?? []).forEach((c, i) => {
        ensureSpace(doc, 18);
        const y = doc.y + 2;
        // bubble
        doc.save().lineWidth(1).circle(CONTENT_LEFT + 26, y + 5, 5).stroke(color.pill).restore();
        doc.fillColor(INK).font("Helvetica").fontSize(10)
          .text(`${String.fromCharCode(65 + i)})  ${cleanForPdf(c)}`, CONTENT_LEFT + 40, y, { width: PAGE_W - 60 });
      });
      doc.moveDown(0.35);
      break;
    case "long":
      answerLines(doc, item.lines ?? 3);
      break;
    case "prompt":
      answerLines(doc, item.lines ?? 4);
      break;
    case "short":
    default: {
      // a short-answer box on the same baseline as the prompt's end
      const y = doc.y + 4;
      answerBox(doc, CONTENT_LEFT + 12, y);
      doc.y = y + 26;
      break;
    }
  }
  doc.moveDown(0.1);
}

// ===========================================================================
//  Section (one per page)
// ===========================================================================
function renderSectionHeader(doc: PDFKit.PDFDocument, idx: number, heading: string, instructions: string | undefined, color: typeof SECTION_COLORS[number]) {
  const pillLabel = `PART ${idx + 1}${heading ? ":  " + heading.toUpperCase() : ""}`;
  const y = doc.y;
  // Auto-size the pill: measure the wrapped text height for the available
  // width so long headings wrap inside the pill instead of being clipped.
  doc.font("Helvetica-Bold").fontSize(11);
  const padX = 14, padY = 6;
  const textW = doc.widthOfString(cleanForPdf(pillLabel));
  const oneLineW = Math.min(PAGE_W, textW + padX * 2);
  const innerW = oneLineW - padX * 2;
  const textH = doc.heightOfString(cleanForPdf(pillLabel), { width: innerW });
  const pillH = textH + padY * 2;
  roundedFill(doc, CONTENT_LEFT, y, oneLineW, pillH, Math.min(12, pillH / 2), color.pill);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
    .text(cleanForPdf(pillLabel), CONTENT_LEFT + padX, y + padY, { width: innerW });
  doc.y = y + pillH + 4;
  if (instructions) {
    doc.fillColor(INK_SOFT).font("Helvetica-Oblique").fontSize(9.5)
      .text(cleanForPdf(instructions), CONTENT_LEFT + 4, doc.y, { width: PAGE_W - 8 });
    doc.moveDown(0.2);
  }
}

// ===========================================================================
//  Skills-Covered ribbon (drawn once, on the last content page)
// ===========================================================================
function renderSkillsRibbon(doc: PDFKit.PDFDocument, content: WorksheetContent) {
  const skills = content.sections.map((s) => s.heading).filter(Boolean) as string[];
  if (!skills.length) return;
  ensureSpace(doc, 56);
  const y = doc.y + 6;
  roundedFill(doc, CONTENT_LEFT, y, PAGE_W, 40, 10, "#eef2ff", "#c7d2fe", 1);
  doc.fillColor(BANNER_A).font("Helvetica-Bold").fontSize(9).text("SKILLS COVERED", CONTENT_LEFT + 12, y + 7);
  doc.fillColor(INK).font("Helvetica").fontSize(9)
    .text(cleanForPdf(skills.join("   •   ")), CONTENT_LEFT + 12, y + 21, { width: PAGE_W - 24, lineBreak: false });
  doc.y = y + 48;
}

// ===========================================================================
//  Public: render to Buffer
// ===========================================================================
export function renderWorksheetPdfBuffer(
  content: WorksheetContent,
  opts: { dateLabel?: string; withAnswerKey?: boolean; footerNote?: string } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      CURRENT_FOOTER = opts.footerNote || "Keep going — you're doing great!";
      const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const sections = Array.isArray(content.sections) ? content.sections : [];

      // First page: banner + the FIRST section (so page 1 isn't a lonely cover).
      pageFooter(doc, CURRENT_FOOTER);
      doc.y = doc.page.margins.top;
      renderBanner(doc, content, { dateLabel: opts.dateLabel });

      let n = 1;
      sections.forEach((sec, si) => {
        const color = SECTION_COLORS[si % SECTION_COLORS.length];
        // PAGE-PER-ASSIGNMENT: every section after the first starts a fresh page.
        if (si > 0) addContentPage(doc);
        renderSectionHeader(doc, si, sec.heading ?? "", sec.instructions, color);
        const items = Array.isArray(sec.items) ? sec.items : [];
        for (const item of items) {
          renderItem(doc, item, n, color);
          if (item.kind !== "passage") n++;
        }
      });

      // Skills ribbon + encouraging close on the final content page.
      renderSkillsRibbon(doc, content);
      ensureSpace(doc, 40);
      const cy = doc.y + 4;
      roundedFill(doc, CONTENT_LEFT, cy, PAGE_W, 30, 10, "#fffbeb", "#fde68a", 1);
      star(doc, CONTENT_LEFT + 16, cy + 15, 7, "#fbbf24");
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11)
        .text("Awesome work — you did it!", CONTENT_LEFT + 30, cy + 9, { width: PAGE_W - 40 });

      // Answer key — always its own fresh page(s).
      if (opts.withAnswerKey) {
        const keyed = sections.flatMap((s) => (Array.isArray(s.items) ? s.items : []).filter((i) => i.answer));
        if (keyed.length) {
          addContentPage(doc);
          doc.y = doc.page.margins.top;
          roundedFill(doc, CONTENT_LEFT, doc.y, PAGE_W, 28, 10, "#1f2937");
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13)
            .text("Answer Key  (for grown-ups)", CONTENT_LEFT + 12, doc.y + 7, { width: PAGE_W - 20 });
          doc.y += 38;
          let k = 1;
          for (const sec of sections) {
            for (const item of (Array.isArray(sec.items) ? sec.items : [])) {
              if (item.kind === "passage") continue;
              if (item.answer) {
                ensureSpace(doc, 18);
                doc.fillColor(INK).font("Helvetica").fontSize(10)
                  .text(`${k}. ${cleanForPdf(item.answer)}`, CONTENT_LEFT + 6, doc.y, { width: PAGE_W - 12 });
              }
              k++;
            }
          }
        }
      }

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}

/** Render + upload. Returns the signed url, storage key, and content hash. */
export async function renderAndStoreWorksheetPdf(
  content: WorksheetContent,
  opts: { forDate: string; printableId: number; withAnswerKey?: boolean; footerNote?: string } = { forDate: "", printableId: 0 },
): Promise<{ key: string; url: string; contentHash: string; fileName: string }> {
  const buf = await renderWorksheetPdfBuffer(content, {
    dateLabel: opts.forDate || undefined,
    withAnswerKey: opts.withAnswerKey ?? true,
    footerNote: opts.footerNote,
  });
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const safeTitle = content.title.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40) || "worksheet";
  const fileName = `${safeTitle}_${opts.forDate || "today"}.pdf`;
  const key = `worksheets/${opts.forDate || "today"}/p${opts.printableId}_${contentHash.slice(0, 8)}.pdf`;
  const { key: storedKey, url } = await storagePut(key, buf, "application/pdf");
  return { key: storedKey, url, contentHash, fileName };
}
