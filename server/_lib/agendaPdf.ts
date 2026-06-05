/**
 * Nightly Agenda PDF builder — v3.11 "Print-and-Go" Packet.
 *
 * Produces a self-contained daily packet that lets Mom, Grandma, or a tutor
 * run the entire school day without logging into the dashboard:
 *
 *   Page 1  — Cover sheet: date, student, tutor, school-day window, block list
 *              with start times, durations, subjects, book page refs, and a
 *              "What's in this packet" summary.
 *              When summerMode is true: "☀ Summer Preview — 6th Grade" banner.
 *   Page 2  — Devotion / scripture / reflection (if set for the day).
 *   Pages … — One full page per block that has ANY content attached:
 *              lesson instructions, objectives, materials, videos (with URLs),
 *              worksheets (embedded images when available, PDF pages merged
 *              inline for PDF worksheets, prominent print-box for external
 *              links that can't be fetched), answer key (adult-only), and
 *              clickable links to every external resource.
 *
 * v3.11 changes:
 *   - PDF worksheet pages are now merged inline using pdf-lib (no more
 *     "PRINT SEPARATELY" box for stored PDFs — they appear in the packet)
 *   - pdfBytes field on worksheet carries fetched PDF bytes from assembler
 *   - External URLs that fail to fetch still show the print-separately box
 *
 * v3.10 changes:
 *   - summerMode flag → "☀ Summer Preview — 6th Grade" cover banner
 *   - resolvedWorksheets: pre-resolved absolute URLs passed in by caller
 *   - Worksheet rendering: try to embed image bytes inline; fall back to a
 *     prominent "PRINT SEPARATELY" box with the absolute URL
 *   - URL fix: /manus-storage/ relative paths resolved to absolute URLs
 *     by the caller (assembleAgendaForDate) before reaching this builder
 */
import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";
import QRCode from "qrcode";

type TocEntry = { blockTitle: string; subjectName: string | null; pageIndex: number };

export type AgendaPdfBlock = {
  sortOrder: number;
  startTime?: string | null;
  durationMin: number;
  subjectName?: string | null;
  subjectEmoji?: string | null;
  title: string;
  description?: string | null;
  curriculumTopicCode?: string | null;
  /** Push 30 (2026-05-13): plain-language topic title shown alongside the code. */
  curriculumTopicTitle?: string | null;
  bookPageRefs?: Array<{ bookTitle: string; fromPage: number; toPage: number }>;
  printablesAttached?: number;
  /**
   * Full self-contained lesson content. When present, the PDF renders one
   * lesson page per block AFTER the cover page.
   */
  lesson?: {
    instructions?: string | null;
    objectives?: string[] | null;
    materials?: string[] | null;
    videos?: Array<{ title: string; url: string; description?: string | null; transcript?: string | null }>;
    worksheets?: Array<{
      title: string;
      description?: string | null;
      questions?: string[] | null;
      printableUrl?: string | null;
      /** v3.10: resolved absolute URL (may differ from printableUrl if it was relative) */
      resolvedUrl?: string | null;
      /** v3.10: fetched image bytes for inline embedding (PNG/JPG only) */
      imageBytes?: Buffer | null;
      /** v3.10: mime type of the fetched resource */
      mimeType?: string | null;
      /** v3.11: fetched PDF bytes for merging into the agenda PDF */
      pdfBytes?: Buffer | null;
    }>;
    answerKey?: string | null;
  } | null;
  /**
   * Push 74 (2026-05-13) — operable + printable per-type block payload.
   */
  generated?: {
    kind: "reading" | "adventure" | "practice" | "video";
    title: string;
    instructions: string[];
    printable: string;
    operable: { url?: string; supplyList?: string[] };
  } | null;
};

export type AgendaPdfInput = {
  forDate: string;       // YYYY-MM-DD
  dayLabel: string;      // "Monday, May 4"
  studentName: string;
  tutorName?: string | null;
  tutorArrival?: string | null;
  tutorDeparture?: string | null;
  blocks: AgendaPdfBlock[];
  tutorNotesYesterday?: { tutorName: string; notes: string } | null;
  schoolDayWindow?: { start: string; end: string } | null;
  /** Optional devotion / scripture / reflection for the day. Prints as its
   *  own page in the print-and-go packet before the block pages. */
  devotionText?: string | null;
  /** v3.10: when true, show "☀ Summer Preview — 6th Grade" banner on cover */
  summerMode?: boolean | null;
  /**
   * v3.32: result of the nightly packet audit (computed by the assembler).
   * Surfaced so the dashboard can show a "today's packet" status chip
   * without re-assembling. Shape mirrors PacketAuditResult; kept loosely
   * typed here to avoid a circular import with packetAudit.ts.
   */
  packetAudit?: {
    forDate: string;
    totalBlocks: number;
    contentBlocks: number;
    emptyBlocks: Array<{
      blockId: number;
      sortOrder: number;
      title: string;
      blockType: string;
      reason: string;
    }>;
    ok: boolean;
  } | null;
};

export type AgendaPdfResult = {
  pdfBuffer: Buffer;
  canonicalText: string;
  agendaHash: string; // sha256 hex
};

/* ------------------------- canonical text snapshot ------------------------ */

function canonicalize(input: AgendaPdfInput): string {
  const lines: string[] = [];
  lines.push(`AGENDA: ${input.forDate} | ${input.dayLabel}`);
  lines.push(`Student: ${input.studentName}`);
  if (input.tutorName) {
    lines.push(`Tutor: ${input.tutorName} | Arrival: ${input.tutorArrival ?? "n/a"} | Departure: ${input.tutorDeparture ?? "n/a"}`);
  }
  if (input.schoolDayWindow) {
    lines.push(`Window: ${input.schoolDayWindow.start} – ${input.schoolDayWindow.end}`);
  }
  if (input.devotionText) {
    lines.push(`Devotion: ${input.devotionText.trim().slice(0, 200)}`);
  }
  for (const b of input.blocks) {
    const parts = [
      `#${b.sortOrder}`,
      b.startTime ? `@${b.startTime}` : "@flex",
      `${b.durationMin}m`,
      b.subjectName ? `[${b.subjectName}]` : "",
      b.curriculumTopicCode
        ? (b.curriculumTopicTitle ? `(${b.curriculumTopicCode}: ${b.curriculumTopicTitle})` : `(${b.curriculumTopicCode})`)
        : "",
      b.title,
    ].filter(Boolean).join(" ");
    lines.push(parts);
    if (b.description) lines.push(`  > ${b.description.trim()}`);
    if (b.bookPageRefs?.length) {
      for (const r of b.bookPageRefs) {
        lines.push(`  > Book: ${r.bookTitle} pg.${r.fromPage}-${r.toPage}`);
      }
    }
  }
  if (input.tutorNotesYesterday) {
    lines.push(`PrevNotes(${input.tutorNotesYesterday.tutorName}): ${input.tutorNotesYesterday.notes.trim()}`);
  }
  return lines.join("\n");
}

export function hashAgenda(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/* ----------------------------- helpers ------------------------------------ */

const BRAND_GREEN  = "#1f3a2e";
const BRAND_BLUE   = "#0a66c2";
const BRAND_WARM   = "#7a4d00";
const BRAND_SUMMER = "#b45309"; // amber-700 — summer banner accent
const GRAY_DARK    = "#222222";
const GRAY_MED     = "#444444";
const GRAY_LIGHT   = "#888888";
const RULE_COLOR   = "#dddddd";
const PAGE_W       = 564; // 8.5in × 72 - 2×48 margin
const MARGIN       = 48;

/**
 * 2026-05-29 — cleanForPdf: PDFKit's built-in Helvetica font is WinAnsi-
 * encoded and renders any code point ≥ U+0100 (and most emoji) as garbled
 * glyphs (e.g. 🧩 → "Ø>Ýé"). Embedding a Unicode font would balloon
 * the PDF size and require shipping font files in the Cloud Run image, which
 * is fragile on a Node-only runtime. Instead we strip the emoji and replace
 * a few common typographic characters with ASCII equivalents the Helvetica
 * WinAnsi table covers cleanly.
 *
 * Applied to every .text() call site below.
 */
export function cleanForPdf(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  let out = String(s);
  // Replace common typographic chars with WinAnsi-safe equivalents
  out = out
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2192\u27A4\u27A1]/g, "->")
    .replace(/[\u25B6\u25BA\u25B8]/g, ">")
    .replace(/[\u2022\u00B7]/g, "\u00b7");
  // Strip variation selectors, zero-width joiners, regional indicators
  out = out.replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, "");
  // Strip all surrogate pairs (covers ≥ U+10000 — every emoji)
  out = out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
  // Strip remaining symbols/pictograph BMP ranges (misc symbols, dingbats,
  // misc-symbols-and-arrows, transport, geometric shapes, enclosed alphanum)
  out = out.replace(/[\u2300-\u23FF\u2460-\u24FF\u2600-\u27BF\u2900-\u29FF\u2B00-\u2BFF\u3000-\u303F]/g, "");
  // Collapse the double-space artefacts left behind by removals
  out = out.replace(/ {2,}/g, " ").trim();
  return out;
}

function rule(doc: PDFKit.PDFDocument) {
  doc.strokeColor(RULE_COLOR).moveTo(MARGIN, doc.y).lineTo(PAGE_W + MARGIN, doc.y).stroke();
  doc.moveDown(0.4);
}

function sectionHead(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(BRAND_GREEN).fontSize(12).font("Helvetica-Bold").text(cleanForPdf(text).toUpperCase(), { characterSpacing: 0.5 });
  doc.font("Helvetica");
  doc.moveDown(0.2);
}

function bodyText(doc: PDFKit.PDFDocument, text: string, opts?: PDFKit.Mixins.TextOptions) {
  doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica").text(cleanForPdf(text), { width: PAGE_W, ...opts });
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica").text(`· ${cleanForPdf(text)}`, { width: PAGE_W, indent: 8 });
}

function answerLine(doc: PDFKit.PDFDocument) {
  // 2026-05-29 — draw a real horizontal rule across the writable width
  // instead of underscore characters, which were getting truncated at
  // smaller widths and looked broken. We move down a fixed line height
  // after each rule so Reagan has consistent paper-feel rows.
  const x = MARGIN + 8;
  const y = doc.y + 10;
  doc.save()
    .strokeColor("#bbbbbb")
    .lineWidth(0.6)
    .moveTo(x, y)
    .lineTo(MARGIN + PAGE_W, y)
    .stroke()
    .restore();
  doc.y = y + 8;
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "flex";
  // Convert HH:MM 24h to h:MM AM/PM
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

/**
 * Render a prominent "PRINT SEPARATELY" box for worksheets that are external
 * URLs that can't be fetched/embedded.
 */
function renderPrintSeparatelyBox(
  doc: PDFKit.PDFDocument,
  title: string,
  absoluteUrl: string,
) {
  const boxX = MARGIN;
  const boxY = doc.y;
  const boxW = PAGE_W;
  const boxH = 54;

  // Dashed border box
  doc.save()
    .rect(boxX, boxY, boxW, boxH)
    .dash(4, { space: 3 })
    .strokeColor("#f59e0b")
    .stroke()
    .undash()
    .restore();

  doc.y = boxY + 8;
  doc.fillColor(BRAND_SUMMER).fontSize(10).font("Helvetica-Bold")
    .text(cleanForPdf("PRINT THIS WORKSHEET SEPARATELY"), { indent: 8, width: PAGE_W - 16 });
  doc.font("Helvetica");
  doc.fillColor(BRAND_BLUE).fontSize(8)
    .text(cleanForPdf(absoluteUrl), {
      link: absoluteUrl,
      underline: true,
      indent: 8,
      width: PAGE_W - 16,
    });
  doc.y = boxY + boxH + 6;
  doc.moveDown(0.2);
}

/* ========================= COVER PAGE ==================================== */

function renderCoverPage(doc: PDFKit.PDFDocument, input: AgendaPdfInput, agendaHash: string) {
  // Summer mode banner — shown ABOVE the title when active
  if (input.summerMode) {
    doc.fillColor(BRAND_SUMMER).fontSize(13).font("Helvetica-Bold")
      .text(cleanForPdf("Summer Preview - 6th Grade"), { align: "center" });
    doc.moveDown(0.15);
  }

  // Title bar
  doc.fillColor(BRAND_GREEN).fontSize(22).font("Helvetica-Bold")
    .text(cleanForPdf(`${input.studentName}'s School Day`), { align: "center" });
  doc.moveDown(0.15);
  doc.fillColor(GRAY_MED).fontSize(14).font("Helvetica").text(cleanForPdf(input.dayLabel), { align: "center" });
  doc.moveDown(0.3);

  // Tutor line
  if (input.tutorName) {
    const tutorLine = `Tutor: ${input.tutorName}` +
      (input.tutorArrival ? `  ·  Arrives ${formatTime(input.tutorArrival)}` : "") +
      (input.tutorDeparture ? `  ·  Leaves ${formatTime(input.tutorDeparture)}` : "");
    doc.fillColor(BRAND_BLUE).fontSize(11).font("Helvetica").text(cleanForPdf(tutorLine), { align: "center" });
    doc.moveDown(0.2);
  }

  // School-day window
  if (input.schoolDayWindow) {
    doc.fillColor(GRAY_LIGHT).fontSize(10).text(
      cleanForPdf(`School day: ${formatTime(input.schoolDayWindow.start)} – ${formatTime(input.schoolDayWindow.end)}`),
      { align: "center" },
    );
    doc.moveDown(0.2);
  }

  doc.moveDown(0.3);
  rule(doc);

  // What's in this packet summary
  const hasDevotionPage = !!input.devotionText;
  // 2026-05-29 — Every block now gets a per-block page (with description +
  // Notes lines) even if it has no curated lesson payload, so the printed
  // packet always has writable space for Reagan to work on offline.
  const detailPageCount = input.blocks.length;
  const totalWorksheets = input.blocks.reduce((s, b) => {
    const ws = b.lesson?.worksheets?.length ?? 0;
    return s + ws;
  }, 0);
  const totalVideos = input.blocks.reduce((s, b) => {
    const vids = b.lesson?.videos?.length ?? 0;
    return s + vids;
  }, 0);

  doc.fillColor(BRAND_GREEN).fontSize(11).font("Helvetica-Bold").text(cleanForPdf("What's in this packet:"));
  doc.font("Helvetica").moveDown(0.15);
  const packetSummary: string[] = [];
  if (hasDevotionPage) packetSummary.push("Devotion / reflection page");
  packetSummary.push("Cover sheet (this page) with today's full schedule");
  if (detailPageCount > 0) packetSummary.push(`${detailPageCount} detail page${detailPageCount === 1 ? "" : "s"} (one per block, with notes space)`);
  if (totalWorksheets > 0) packetSummary.push(`${totalWorksheets} worksheet${totalWorksheets === 1 ? "" : "s"} embedded in packet`);
  if (totalVideos > 0) packetSummary.push(`${totalVideos} video link${totalVideos === 1 ? "" : "s"} with descriptions`);
  for (const line of packetSummary) {
    bullet(doc, line);
  }
  doc.moveDown(0.4);
  rule(doc);

  // Block list
  doc.fillColor(BRAND_GREEN).fontSize(13).font("Helvetica-Bold").text(cleanForPdf("Today's Schedule"));
  doc.font("Helvetica").moveDown(0.3);

  if (input.blocks.length === 0) {
    doc.fillColor(GRAY_LIGHT).fontSize(11).text(cleanForPdf("No blocks scheduled."));
  }

  for (const b of input.blocks) {
    const timeStr = formatTime(b.startTime);
    const subj = b.subjectName ? ` [${b.subjectName}]` : "";
    const topicStr = b.curriculumTopicCode
      ? (b.curriculumTopicTitle
          ? `  ·  ${b.curriculumTopicCode}: ${b.curriculumTopicTitle}`
          : `  ·  ${b.curriculumTopicCode}`)
      : "";

    // Block header row
    doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica-Bold")
      .text(cleanForPdf(`${b.sortOrder}.  ${timeStr}  ·  ${b.durationMin} min${subj}${topicStr}`), { continued: false });
    doc.font("Helvetica");
    doc.fillColor(GRAY_DARK).fontSize(11).text(cleanForPdf(`   ${b.title}`), { indent: 4 });

    if (b.description) {
      doc.fillColor(GRAY_MED).fontSize(9).text(cleanForPdf(`   ${b.description.trim()}`), { width: PAGE_W, indent: 4 });
    }
    if (b.bookPageRefs?.length) {
      for (const r of b.bookPageRefs) {
        doc.fillColor(BRAND_BLUE).fontSize(9).text(cleanForPdf(`   ${r.bookTitle} - pg. ${r.fromPage}-${r.toPage}`), { indent: 4 });
      }
    }
    // Every block gets a per-block detail page; cover always points to it.
    doc.fillColor(GRAY_LIGHT).fontSize(8).text(cleanForPdf(`   -> Detail page in this packet (notes space below)`), { indent: 4 });
    // Surface generated payload hint on cover
    if (b.generated && !b.description && !(b.bookPageRefs && b.bookPageRefs.length > 0)) {
      doc.fillColor(BRAND_WARM).fontSize(9).text(cleanForPdf(`   ${b.generated.printable}`), { indent: 4 });
    }
    doc.moveDown(0.4);
  }

  // Yesterday's tutor notes
  if (input.tutorNotesYesterday) {
    doc.moveDown(0.2);
    rule(doc);
    doc.fillColor(BRAND_GREEN).fontSize(11).font("Helvetica-Bold").text(cleanForPdf("From yesterday's tutor"));
    doc.font("Helvetica");
    doc.fillColor(GRAY_DARK).fontSize(10)
      .text(cleanForPdf(`${input.tutorNotesYesterday.tutorName}: ${input.tutorNotesYesterday.notes.trim()}`), { width: PAGE_W });
    doc.moveDown(0.3);
  }

  // Footer
  doc.moveDown(0.4);
  doc.fillColor(GRAY_LIGHT).fontSize(7)
    .text(cleanForPdf(`Packet hash: ${agendaHash.slice(0, 16)}...  ·  Generated for ${input.forDate}  ·  If anything changes before school, this packet will be re-sent.`));
}

/* ========================= DEVOTION PAGE ================================== */

function renderDevotionPage(doc: PDFKit.PDFDocument, input: AgendaPdfInput) {
  if (!input.devotionText) return;
  doc.addPage();
  doc.fillColor(BRAND_GREEN).fontSize(20).font("Helvetica-Bold").text(cleanForPdf("Today's Devotion"), { align: "center" });
  doc.moveDown(0.2);
  doc.fillColor(GRAY_MED).fontSize(11).font("Helvetica").text(cleanForPdf(input.dayLabel), { align: "center" });
  doc.moveDown(0.5);
  rule(doc);
  doc.moveDown(0.3);
  doc.fillColor(GRAY_DARK).fontSize(12).font("Helvetica").text(cleanForPdf(input.devotionText.trim()), { width: PAGE_W });
  doc.moveDown(0.8);
  rule(doc);
  doc.fillColor(GRAY_LIGHT).fontSize(9).text(cleanForPdf("Reflection space:"), { indent: 0 });
  doc.moveDown(0.2);
  for (let i = 0; i < 6; i++) answerLine(doc);
}

/* ========================= BLOCK LESSON PAGES ============================ */

function renderLessonPage(doc: PDFKit.PDFDocument, input: AgendaPdfInput, b: AgendaPdfBlock, tocSink?: TocEntry[]) {
  doc.addPage();
  // Track which pdfkit page index this block's lesson page lives on. After
  // pdf-lib insertion of the ToC page (position 1) all of these get +1.
  if (tocSink) {
    // pdfkit doesn't expose a stable page-index counter — we count by tracking
    // doc.bufferedPageRange() at the moment we addPage above.
    const range = doc.bufferedPageRange();
    const pageIndex = range.start + range.count - 1; // 0-based
    tocSink.push({ blockTitle: `${b.sortOrder}. ${b.title}`, subjectName: b.subjectName ?? null, pageIndex });
  }

  // Page header
  doc.fillColor(BRAND_GREEN).fontSize(18).font("Helvetica-Bold").text(cleanForPdf(`${b.sortOrder}. ${b.title}`));
  doc.font("Helvetica");
  doc.fillColor(GRAY_LIGHT).fontSize(10).text(
    cleanForPdf([
      formatTime(b.startTime),
      `${b.durationMin} min`,
      b.subjectName ?? null,
      b.curriculumTopicCode
        ? (b.curriculumTopicTitle ? `${b.curriculumTopicCode}: ${b.curriculumTopicTitle}` : b.curriculumTopicCode)
        : null,
    ].filter(Boolean).join("  ·  ")),
  );
  doc.moveDown(0.3);
  rule(doc);

  const L = b.lesson;
  if (L) {
    // Description
    if (b.description) {
      bodyText(doc, b.description.trim());
      doc.moveDown(0.3);
    }

    // Objectives
    if (L.objectives && L.objectives.length > 0) {
      sectionHead(doc, "Learning Objectives");
      for (const obj of L.objectives) bullet(doc, obj);
      doc.moveDown(0.3);
    }

    // Materials
    if (L.materials && L.materials.length > 0) {
      sectionHead(doc, "Materials Needed");
      for (const mat of L.materials) bullet(doc, mat);
      doc.moveDown(0.3);
    }

    // Instructions
    if (L.instructions && L.instructions.trim().length > 0) {
      sectionHead(doc, "Instructions");
      bodyText(doc, L.instructions.trim());
      doc.moveDown(0.3);
    }

    // Book page refs
    if (b.bookPageRefs && b.bookPageRefs.length > 0) {
      sectionHead(doc, "Reading Assignment");
      for (const r of b.bookPageRefs) {
        bullet(doc, `${r.bookTitle} — pages ${r.fromPage}–${r.toPage}`);
      }
      doc.moveDown(0.3);
    }

    // v3.16 (2026-05-30) — Per-type video block: render QR + description.
    // Triggered when the assembler attached `generated.kind === "video"`.
    if (b.generated && b.generated.kind === "video" && b.generated.operable?.url) {
      sectionHead(doc, "Watch this video");
      const url = b.generated.operable.url;
      // Description from the generator’s instructions[1] (the "why" line).
      const desc = b.generated.instructions[1] ?? "";
      if (desc) {
        doc.fillColor(GRAY_MED).fontSize(10).text(cleanForPdf(desc), { width: PAGE_W, indent: 4 });
        doc.moveDown(0.2);
      }
      // Render the QR code as a PNG buffer and place it on the page.
      try {
        const qrPng = (b.generated as any).__qrPngBuffer as Buffer | undefined;
        if (qrPng) {
          const qrSize = 110;
          const qrX = MARGIN;
          const qrY = doc.y;
          doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });
          // Caption + clickable URL beside the QR.
          const textX = qrX + qrSize + 12;
          const textW = PAGE_W - qrSize - 12;
          doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica-Bold")
            .text(cleanForPdf("Scan with a phone camera"), textX, qrY + 4, { width: textW });
          doc.font("Helvetica").fillColor(BRAND_BLUE).fontSize(9)
            .text(cleanForPdf(url), textX, qrY + 22, { width: textW, link: url, underline: true });
          doc.fillColor(GRAY_LIGHT).fontSize(8)
            .text(cleanForPdf("or type the URL above into a browser."), textX, qrY + 60, { width: textW });
          doc.y = qrY + qrSize + 8;
        } else {
          // Fall back to a clickable URL line if QR generation failed upstream.
          doc.fillColor(BRAND_BLUE).fontSize(10)
            .text(cleanForPdf(url), { link: url, underline: true, indent: 4, width: PAGE_W });
        }
      } catch {
        doc.fillColor(BRAND_BLUE).fontSize(10)
          .text(cleanForPdf(url), { link: url, underline: true, indent: 4, width: PAGE_W });
      }
      doc.moveDown(0.4);
    }

    // Videos — with clickable URLs
    if (L.videos && L.videos.length > 0) {
      sectionHead(doc, "Videos");
      for (const v of L.videos) {
        doc.fillColor(GRAY_DARK).fontSize(11).font("Helvetica-Bold")
          .text(cleanForPdf(`> ${v.title}`), { link: v.url || undefined, underline: !!v.url });
        doc.font("Helvetica");
        if (v.url) {
          doc.fillColor(BRAND_BLUE).fontSize(8).text(cleanForPdf(v.url), { link: v.url, underline: true, indent: 8, width: PAGE_W });
        }
        if (v.description) {
          doc.fillColor(GRAY_MED).fontSize(9).text(cleanForPdf(v.description.trim()), { indent: 8, width: PAGE_W });
        }
        if (v.transcript) {
          doc.fillColor(GRAY_DARK).fontSize(9).font("Helvetica-Bold").text(cleanForPdf("Transcript:"), { indent: 8 });
          doc.font("Helvetica").fillColor(GRAY_MED).fontSize(8).text(cleanForPdf(v.transcript.trim()), { indent: 8, width: PAGE_W });
          doc.moveDown(0.15);
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.1);
    }

    // Worksheets — embed images inline; merge PDF pages; show print-box for unfetchable external links
    if (L.worksheets && L.worksheets.length > 0) {
      sectionHead(doc, "Worksheets & Activities");
      for (const w of L.worksheets) {
        doc.fillColor(GRAY_DARK).fontSize(12).font("Helvetica-Bold").text(cleanForPdf(w.title));
        doc.font("Helvetica");
        if (w.description) {
          doc.fillColor(GRAY_MED).fontSize(9).text(cleanForPdf(w.description.trim()), { width: PAGE_W, indent: 4 });
        }
        // v3.11: Try to embed image inline; PDF bytes are merged after pdfkit finishes
        const displayUrl = w.resolvedUrl || w.printableUrl || null;
        if (w.imageBytes && w.mimeType && (w.mimeType.startsWith("image/jpeg") || w.mimeType.startsWith("image/png"))) {
          // Embed the image directly — scale to fit page width
          try {
            doc.moveDown(0.2);
            const maxImgW = PAGE_W;
            const maxImgH = 500; // max height before it overflows
            doc.image(w.imageBytes, MARGIN, doc.y, {
              fit: [maxImgW, maxImgH],
              align: "center",
            });
            doc.moveDown(0.3);
            if (displayUrl) {
              doc.fillColor(GRAY_LIGHT).fontSize(7)
                .text(cleanForPdf(`Source: ${displayUrl}`), { indent: 4, width: PAGE_W });
            }
          } catch {
            // If image embedding fails, fall back to print-separately box
            if (displayUrl) renderPrintSeparatelyBox(doc, w.title, displayUrl);
          }
        } else if (w.pdfBytes) {
          // PDF bytes available — will be merged after pdfkit finishes.
          // Show a placeholder note so the reader knows pages follow.
          doc.moveDown(0.2);
          const boxX = MARGIN;
          const boxY = doc.y;
          const boxW = PAGE_W;
          const boxH = 40;
          doc.save()
            .rect(boxX, boxY, boxW, boxH)
            .fillColor("#f0fdf4")
            .fill()
            .rect(boxX, boxY, boxW, boxH)
            .strokeColor("#16a34a")
            .lineWidth(1)
            .stroke()
            .restore();
          doc.y = boxY + 8;
          doc.fillColor("#16a34a").fontSize(10).font("Helvetica-Bold")
            .text(cleanForPdf("Worksheet pages follow immediately after this block"), { indent: 8, width: PAGE_W - 16 });
          doc.font("Helvetica");
          doc.fillColor(GRAY_MED).fontSize(8)
            .text(cleanForPdf(w.title), { indent: 8, width: PAGE_W - 16 });
          doc.y = boxY + boxH + 6;
          doc.moveDown(0.2);
        } else if (displayUrl) {
          // PDF or external URL — show prominent print-separately box
          renderPrintSeparatelyBox(doc, w.title, displayUrl);
        }
        // Inline questions with writable answer lines
        if (w.questions && w.questions.length > 0) {
          doc.moveDown(0.2);
          for (let i = 0; i < w.questions.length; i++) {
            doc.fillColor(GRAY_DARK).fontSize(10).text(cleanForPdf(`${i + 1}. ${w.questions[i]}`), { width: PAGE_W, indent: 4 });
            answerLine(doc);
          }
        } else if (!displayUrl && !w.imageBytes && !w.pdfBytes) {
          // No URL and no questions — add a few blank answer lines so the
          // block is still writable on paper.
          doc.moveDown(0.1);
          for (let i = 0; i < 4; i++) answerLine(doc);
        }
        doc.moveDown(0.3);
      }
    }

    // Answer key — adult-only, smaller text, clearly labelled
    if (L.answerKey && L.answerKey.trim().length > 0) {
      doc.moveDown(0.2);
      rule(doc);
      doc.fillColor(GRAY_LIGHT).fontSize(8).font("Helvetica-Bold")
        .text(cleanForPdf("ANSWER KEY (for adult use only)"));
      doc.font("Helvetica");
      doc.fillColor(GRAY_MED).fontSize(8).text(cleanForPdf(L.answerKey.trim()), { width: PAGE_W });
      doc.moveDown(0.2);
    }
  }

  // 2026-05-29 — fallback per-block detail when no curated lesson and no
  // generated payload: render the AI-written description + Notes lines so
  // there's always writable space on paper. This also ensures the cover
  // sheet's "X detail pages" count is always accurate.
  if (!L && !b.generated) {
    if (b.description) {
      bodyText(doc, b.description.trim());
      doc.moveDown(0.3);
    }
    if (b.bookPageRefs && b.bookPageRefs.length > 0) {
      sectionHead(doc, "Reading Assignment");
      for (const r of b.bookPageRefs) {
        bullet(doc, `${r.bookTitle} - pages ${r.fromPage}-${r.toPage}`);
      }
      doc.moveDown(0.3);
    }
    sectionHead(doc, "Notes / Work Space");
    for (let i = 0; i < 10; i++) answerLine(doc);
    doc.moveDown(0.3);
  }

  // Generated payload (adventure / practice / reading)
  const G = b.generated;
  if (G && !L) {
    if (G.kind === "adventure" && G.instructions[0]) {
      doc.fillColor(BRAND_WARM).fontSize(10).font("Helvetica-Bold")
        .text(cleanForPdf(`Safety: ${G.instructions[0]}`), { width: PAGE_W });
      doc.font("Helvetica");
      doc.moveDown(0.2);
    }
    const stepsToRender = G.kind === "adventure" ? G.instructions.slice(1) : G.instructions;
    if (stepsToRender.length > 0) {
      sectionHead(doc, "What to Do");
      for (const step of stepsToRender) bullet(doc, step);
      doc.moveDown(0.3);
    }
    if (G.operable.supplyList && G.operable.supplyList.length > 0) {
      sectionHead(doc, "What You Need");
      for (const s of G.operable.supplyList) bullet(doc, s);
      doc.moveDown(0.3);
    }
    if (G.printable) {
      sectionHead(doc, "Try These");
      bodyText(doc, G.printable);
      doc.moveDown(0.2);
      for (let i = 0; i < 4; i++) answerLine(doc);
    }
    if (G.operable.url) {
      doc.moveDown(0.2);
      doc.fillColor(BRAND_BLUE).fontSize(9)
        .text(cleanForPdf(`Open online: ${G.operable.url}`), { link: G.operable.url, underline: true });
    }
  }

  // Page footer
  doc.moveDown(0.4);
  doc.fillColor(GRAY_LIGHT).fontSize(7)
    .text(cleanForPdf(`Block ${b.sortOrder} of ${input.blocks.length}  ·  ${input.studentName}  ·  ${input.forDate}`));
}

/* ========================= MAIN BUILDER ================================== */

/**
 * Collect all worksheet PDF buffers from all blocks, in order.
 * Returns array of { blockTitle, worksheetTitle, pdfBytes } for merging.
 */
function collectPdfWorksheets(input: AgendaPdfInput): Array<{ blockTitle: string; worksheetTitle: string; pdfBytes: Buffer }> {
  const result: Array<{ blockTitle: string; worksheetTitle: string; pdfBytes: Buffer }> = [];
  for (const b of input.blocks) {
    if (!b.lesson?.worksheets) continue;
    for (const w of b.lesson.worksheets) {
      if (w.pdfBytes) {
        result.push({ blockTitle: b.title, worksheetTitle: w.title, pdfBytes: w.pdfBytes });
      }
    }
  }
  return result;
}

export async function buildAgendaPdf(input: AgendaPdfInput): Promise<AgendaPdfResult> {
  const canonical = canonicalize(input);
  const agendaHash = hashAgenda(canonical);

  // bufferPages:true — lets us walk all pages later for page-number stamping.
  const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Page 1: Cover sheet
  renderCoverPage(doc, input, agendaHash);

  // Page 2: Devotion (if set)
  if (input.devotionText) {
    renderDevotionPage(doc, input);
  }

  // 2026-05-29 — Per-block detail pages for ALL blocks.
  // 2026-05-30 — Track block-to-page mapping for ToC.
  const tocEntries: TocEntry[] = [];
  for (const b of input.blocks) {
    renderLessonPage(doc, input, b, tocEntries);
  }

  doc.end();
  await done;

  let pdfBuffer = Buffer.concat(chunks);

  // ----------------------- pdf-lib post-processing -----------------------
  // 1) merge worksheet PDF pages, 2) insert ToC after cover, 3) stamp page numbers.
  try {
    const { PDFDocument: PdfLib, StandardFonts, rgb } = await import("pdf-lib");
    const mainDoc = await PdfLib.load(pdfBuffer);

    // 1) Merge worksheet PDFs (existing behavior; appended to end)
    const pdfWorksheets = collectPdfWorksheets(input);
    for (const ws of pdfWorksheets) {
      try {
        const wsDoc = await PdfLib.load(ws.pdfBytes);
        const pageCount = wsDoc.getPageCount();
        if (pageCount === 0) continue;
        const copiedPages = await mainDoc.copyPages(wsDoc, wsDoc.getPageIndices());
        for (const page of copiedPages) mainDoc.addPage(page);
      } catch {
        // skip a bad worksheet silently
      }
    }

    // 2) Insert ToC page right after the cover (page index 1).
    if (tocEntries.length > 0) {
      // After ToC insert, every existing page (including blocks) shifts +1.
      const tocFont = await mainDoc.embedFont(StandardFonts.HelveticaBold);
      const bodyFont = await mainDoc.embedFont(StandardFonts.Helvetica);
      const tocPage = mainDoc.insertPage(1); // LETTER by default
      const { width, height } = tocPage.getSize();
      const left = MARGIN;
      const right = width - MARGIN;
      let y = height - MARGIN;
      tocPage.drawText("Table of Contents", {
        x: left, y: y - 18,
        size: 20, font: tocFont, color: rgb(0.18, 0.42, 0.32), // BRAND_GREEN-ish
      });
      y -= 40;
      tocPage.drawText(`${input.studentName} — ${input.forDate}`, {
        x: left, y, size: 10, font: bodyFont, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 24;
      // Each entry: title (left), dotted leader, page number (right)
      // Block lesson pages are at tocEntries[i].pageIndex + 1 (because we
      // inserted the ToC page at position 1, shifting them).
      const lineHeight = 16;
      for (const e of tocEntries) {
        if (y < MARGIN + 30) break; // ToC > 1 page is rare; truncate gracefully
        const finalPageNum = e.pageIndex + 1 + 1; // 0-based pdfkit index + 1 (ToC shift) + 1 (1-based for humans)
        const title = e.subjectName ? `${e.blockTitle}  ·  ${e.subjectName}` : e.blockTitle;
        tocPage.drawText(title.slice(0, 70), {
          x: left, y, size: 11, font: bodyFont, color: rgb(0.2, 0.2, 0.2),
        });
        const pageStr = String(finalPageNum);
        const pageStrWidth = bodyFont.widthOfTextAtSize(pageStr, 11);
        tocPage.drawText(pageStr, {
          x: right - pageStrWidth, y, size: 11, font: bodyFont, color: rgb(0.2, 0.2, 0.2),
        });
        y -= lineHeight;
      }
    }

    // 3) Stamp "Page X of Y" footer on every page (after all merges/inserts).
    const totalPages = mainDoc.getPageCount();
    const footerFont = await mainDoc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < totalPages; i++) {
      const page = mainDoc.getPage(i);
      const { width } = page.getSize();
      const label = `Page ${i + 1} of ${totalPages}`;
      const textWidth = footerFont.widthOfTextAtSize(label, 8);
      page.drawText(label, {
        x: (width - textWidth) / 2,
        y: 18,
        size: 8,
        font: footerFont,
        color: rgb(0.55, 0.55, 0.55),
      });
    }

    pdfBuffer = Buffer.from(await mainDoc.save());
  } catch {
    // If pdf-lib post-processing fails entirely, fall back to the raw pdfkit PDF.
  }

  return { pdfBuffer, canonicalText: canonical, agendaHash };
}
