/**
 * Nightly Agenda PDF builder — v3.10 "Print-and-Go" Packet.
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
 *              worksheets (embedded images when available, prominent print-box
 *              for PDF/external links), answer key (adult-only), and clickable
 *              links to every external resource.
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
    }>;
    answerKey?: string | null;
  } | null;
  /**
   * Push 74 (2026-05-13) — operable + printable per-type block payload.
   */
  generated?: {
    kind: "reading" | "adventure" | "practice";
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

function rule(doc: PDFKit.PDFDocument) {
  doc.strokeColor(RULE_COLOR).moveTo(MARGIN, doc.y).lineTo(PAGE_W + MARGIN, doc.y).stroke();
  doc.moveDown(0.4);
}

function sectionHead(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(BRAND_GREEN).fontSize(12).font("Helvetica-Bold").text(text.toUpperCase(), { characterSpacing: 0.5 });
  doc.font("Helvetica");
  doc.moveDown(0.2);
}

function bodyText(doc: PDFKit.PDFDocument, text: string, opts?: PDFKit.Mixins.TextOptions) {
  doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica").text(text, { width: PAGE_W, ...opts });
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica").text(`• ${text}`, { width: PAGE_W, indent: 8 });
}

function answerLine(doc: PDFKit.PDFDocument) {
  doc.fillColor("#cccccc").fontSize(10).text(
    "___________________________________________",
    { width: PAGE_W, indent: 8 },
  );
  doc.moveDown(0.1);
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
 * Render a prominent "PRINT SEPARATELY" box for worksheets that are PDFs
 * or external URLs that can't be embedded inline.
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
    .text("📄  PRINT THIS WORKSHEET SEPARATELY", { indent: 8, width: PAGE_W - 16 });
  doc.font("Helvetica");
  doc.fillColor(BRAND_BLUE).fontSize(8)
    .text(absoluteUrl, {
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
      .text("☀  Summer Preview — 6th Grade", { align: "center" });
    doc.moveDown(0.15);
  }

  // Title bar
  doc.fillColor(BRAND_GREEN).fontSize(22).font("Helvetica-Bold")
    .text(`${input.studentName}'s School Day`, { align: "center" });
  doc.moveDown(0.15);
  doc.fillColor(GRAY_MED).fontSize(14).font("Helvetica").text(input.dayLabel, { align: "center" });
  doc.moveDown(0.3);

  // Tutor line
  if (input.tutorName) {
    const tutorLine = `Tutor: ${input.tutorName}` +
      (input.tutorArrival ? `  ·  Arrives ${formatTime(input.tutorArrival)}` : "") +
      (input.tutorDeparture ? `  ·  Leaves ${formatTime(input.tutorDeparture)}` : "");
    doc.fillColor(BRAND_BLUE).fontSize(11).font("Helvetica").text(tutorLine, { align: "center" });
    doc.moveDown(0.2);
  }

  // School-day window
  if (input.schoolDayWindow) {
    doc.fillColor(GRAY_LIGHT).fontSize(10).text(
      `School day: ${formatTime(input.schoolDayWindow.start)} – ${formatTime(input.schoolDayWindow.end)}`,
      { align: "center" },
    );
    doc.moveDown(0.2);
  }

  doc.moveDown(0.3);
  rule(doc);

  // What's in this packet summary
  const hasDevotionPage = !!input.devotionText;
  const blocksWithContent = input.blocks.filter((b) => !!b.lesson || !!b.generated);
  const totalWorksheets = input.blocks.reduce((s, b) => {
    const ws = b.lesson?.worksheets?.length ?? 0;
    return s + ws;
  }, 0);
  const totalVideos = input.blocks.reduce((s, b) => {
    const vids = b.lesson?.videos?.length ?? 0;
    return s + vids;
  }, 0);

  doc.fillColor(BRAND_GREEN).fontSize(11).font("Helvetica-Bold").text("What's in this packet:");
  doc.font("Helvetica").moveDown(0.15);
  const packetSummary: string[] = [];
  if (hasDevotionPage) packetSummary.push("📖 Devotion / reflection page");
  packetSummary.push(`📋 Cover sheet (this page) with today's full schedule`);
  if (blocksWithContent.length > 0) packetSummary.push(`📄 ${blocksWithContent.length} detailed lesson page${blocksWithContent.length === 1 ? "" : "s"} (one per block)`);
  if (totalWorksheets > 0) packetSummary.push(`✏️  ${totalWorksheets} worksheet${totalWorksheets === 1 ? "" : "s"} with answer lines`);
  if (totalVideos > 0) packetSummary.push(`▶  ${totalVideos} video link${totalVideos === 1 ? "" : "s"} with descriptions`);
  for (const line of packetSummary) {
    bullet(doc, line);
  }
  doc.moveDown(0.4);
  rule(doc);

  // Block list
  doc.fillColor(BRAND_GREEN).fontSize(13).font("Helvetica-Bold").text("Today's Schedule");
  doc.font("Helvetica").moveDown(0.3);

  if (input.blocks.length === 0) {
    doc.fillColor(GRAY_LIGHT).fontSize(11).text("No blocks scheduled.");
  }

  for (const b of input.blocks) {
    const timeStr = formatTime(b.startTime);
    const subj = b.subjectName ? ` [${b.subjectName}]` : "";
    const topicStr = b.curriculumTopicCode
      ? (b.curriculumTopicTitle
          ? `  ·  ${b.curriculumTopicCode}: ${b.curriculumTopicTitle}`
          : `  ·  ${b.curriculumTopicCode}`)
      : "";
    const hasPage = !!b.lesson || !!b.generated;

    // Block header row
    doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica-Bold")
      .text(`${b.sortOrder}.  ${timeStr}  ·  ${b.durationMin} min${subj}${topicStr}`, { continued: false });
    doc.font("Helvetica");
    doc.fillColor(GRAY_DARK).fontSize(11).text(`   ${b.title}`, { indent: 4 });

    if (b.description) {
      doc.fillColor(GRAY_MED).fontSize(9).text(`   ${b.description.trim()}`, { width: PAGE_W, indent: 4 });
    }
    if (b.bookPageRefs?.length) {
      for (const r of b.bookPageRefs) {
        doc.fillColor(BRAND_BLUE).fontSize(9).text(`   📖 ${r.bookTitle} — pg. ${r.fromPage}–${r.toPage}`, { indent: 4 });
      }
    }
    if (hasPage) {
      doc.fillColor(GRAY_LIGHT).fontSize(8).text(`   → See lesson page in this packet`, { indent: 4 });
    }
    // Surface generated payload hint on cover
    if (b.generated && !b.description && !(b.bookPageRefs && b.bookPageRefs.length > 0)) {
      const kindIcon = b.generated.kind === "reading" ? "📖" :
                       b.generated.kind === "adventure" ? "🌟" : "🎯";
      doc.fillColor(BRAND_WARM).fontSize(9).text(`   ${kindIcon} ${b.generated.printable}`, { indent: 4 });
    }
    doc.moveDown(0.4);
  }

  // Yesterday's tutor notes
  if (input.tutorNotesYesterday) {
    doc.moveDown(0.2);
    rule(doc);
    doc.fillColor(BRAND_GREEN).fontSize(11).font("Helvetica-Bold").text("From yesterday's tutor");
    doc.font("Helvetica");
    doc.fillColor(GRAY_DARK).fontSize(10)
      .text(`${input.tutorNotesYesterday.tutorName}: ${input.tutorNotesYesterday.notes.trim()}`, { width: PAGE_W });
    doc.moveDown(0.3);
  }

  // Footer
  doc.moveDown(0.4);
  doc.fillColor(GRAY_LIGHT).fontSize(7)
    .text(`Packet hash: ${agendaHash.slice(0, 16)}…  ·  Generated for ${input.forDate}  ·  If anything changes before school, this packet will be re-sent.`);
}

/* ========================= DEVOTION PAGE ================================== */

function renderDevotionPage(doc: PDFKit.PDFDocument, input: AgendaPdfInput) {
  if (!input.devotionText) return;
  doc.addPage();
  doc.fillColor(BRAND_GREEN).fontSize(20).font("Helvetica-Bold").text("Today's Devotion", { align: "center" });
  doc.moveDown(0.2);
  doc.fillColor(GRAY_MED).fontSize(11).font("Helvetica").text(input.dayLabel, { align: "center" });
  doc.moveDown(0.5);
  rule(doc);
  doc.moveDown(0.3);
  doc.fillColor(GRAY_DARK).fontSize(12).font("Helvetica").text(input.devotionText.trim(), { width: PAGE_W });
  doc.moveDown(0.8);
  rule(doc);
  doc.fillColor(GRAY_LIGHT).fontSize(9).text("Reflection space:", { indent: 0 });
  doc.moveDown(0.2);
  for (let i = 0; i < 6; i++) answerLine(doc);
}

/* ========================= BLOCK LESSON PAGES ============================ */

function renderLessonPage(doc: PDFKit.PDFDocument, input: AgendaPdfInput, b: AgendaPdfBlock) {
  doc.addPage();

  // Page header
  doc.fillColor(BRAND_GREEN).fontSize(18).font("Helvetica-Bold").text(`${b.sortOrder}. ${b.title}`);
  doc.font("Helvetica");
  doc.fillColor(GRAY_LIGHT).fontSize(10).text(
    [
      formatTime(b.startTime),
      `${b.durationMin} min`,
      b.subjectName ?? null,
      b.curriculumTopicCode
        ? (b.curriculumTopicTitle ? `${b.curriculumTopicCode} · ${b.curriculumTopicTitle}` : b.curriculumTopicCode)
        : null,
    ].filter(Boolean).join("  ·  "),
  );
  doc.moveDown(0.3);
  rule(doc);

  if (b.description) {
    bodyText(doc, b.description.trim());
    doc.moveDown(0.3);
  }

  // Book page refs
  if (b.bookPageRefs?.length) {
    sectionHead(doc, "Book Assignment");
    for (const r of b.bookPageRefs) {
      bullet(doc, `${r.bookTitle} — pages ${r.fromPage}–${r.toPage}`);
    }
    doc.moveDown(0.3);
  }

  const L = b.lesson;
  if (L) {
    // Objectives
    if (L.objectives && L.objectives.length > 0) {
      sectionHead(doc, "Learning Goals");
      for (const o of L.objectives) bullet(doc, o);
      doc.moveDown(0.3);
    }

    // Materials
    if (L.materials && L.materials.length > 0) {
      sectionHead(doc, "What You Need");
      for (const m of L.materials) bullet(doc, m);
      doc.moveDown(0.3);
    }

    // Instructions / lesson body
    if (L.instructions && L.instructions.trim().length > 0) {
      sectionHead(doc, "Instructions");
      bodyText(doc, L.instructions.trim());
      doc.moveDown(0.3);
    }

    // Videos — with clickable URLs
    if (L.videos && L.videos.length > 0) {
      sectionHead(doc, "Watch First");
      for (const v of L.videos) {
        doc.fillColor(BRAND_BLUE).fontSize(11).font("Helvetica-Bold")
          .text(`▶ ${v.title}`, { link: v.url || undefined, underline: !!v.url });
        doc.font("Helvetica");
        if (v.description) {
          doc.fillColor(GRAY_MED).fontSize(9).text(v.description.trim(), { width: PAGE_W, indent: 8 });
        }
        if (v.url) {
          doc.fillColor(BRAND_BLUE).fontSize(8).text(v.url, { link: v.url, underline: true, indent: 8, width: PAGE_W });
        }
        if (v.transcript) {
          doc.fillColor(GRAY_LIGHT).fontSize(7)
            .text(`Transcript: ${v.transcript.trim().slice(0, 800)}${v.transcript.length > 800 ? "…" : ""}`,
              { width: PAGE_W, indent: 8 });
        }
        doc.moveDown(0.3);
      }
    }

    // Worksheets — embed images inline; show print-box for PDFs/external links
    if (L.worksheets && L.worksheets.length > 0) {
      sectionHead(doc, "Worksheets & Activities");
      for (const w of L.worksheets) {
        doc.fillColor(GRAY_DARK).fontSize(12).font("Helvetica-Bold").text(w.title);
        doc.font("Helvetica");
        if (w.description) {
          doc.fillColor(GRAY_MED).fontSize(9).text(w.description.trim(), { width: PAGE_W, indent: 4 });
        }

        // v3.10: Try to embed image inline; fall back to print-separately box
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
                .text(`Source: ${displayUrl}`, { indent: 4, width: PAGE_W });
            }
          } catch {
            // If image embedding fails, fall back to print-separately box
            if (displayUrl) renderPrintSeparatelyBox(doc, w.title, displayUrl);
          }
        } else if (displayUrl) {
          // PDF or external URL — show prominent print-separately box
          renderPrintSeparatelyBox(doc, w.title, displayUrl);
        }

        // Inline questions with writable answer lines
        if (w.questions && w.questions.length > 0) {
          doc.moveDown(0.2);
          for (let i = 0; i < w.questions.length; i++) {
            doc.fillColor(GRAY_DARK).fontSize(10).text(`${i + 1}. ${w.questions[i]}`, { width: PAGE_W, indent: 4 });
            answerLine(doc);
          }
        } else if (!displayUrl && !w.imageBytes) {
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
        .text("ANSWER KEY (for adult use only)");
      doc.font("Helvetica");
      doc.fillColor(GRAY_MED).fontSize(8).text(L.answerKey.trim(), { width: PAGE_W });
      doc.moveDown(0.2);
    }
  }

  // Generated payload (adventure / practice / reading)
  const G = b.generated;
  if (G && !L) {
    if (G.kind === "adventure" && G.instructions[0]) {
      doc.fillColor(BRAND_WARM).fontSize(10).font("Helvetica-Bold")
        .text(`Safety: ${G.instructions[0]}`, { width: PAGE_W });
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
        .text(`Open online: ${G.operable.url}`, { link: G.operable.url, underline: true });
    }
  }

  // Page footer
  doc.moveDown(0.4);
  doc.fillColor(GRAY_LIGHT).fontSize(7)
    .text(`Block ${b.sortOrder} of ${input.blocks.length}  ·  ${input.studentName}  ·  ${input.forDate}`);
}

/* ========================= MAIN BUILDER ================================== */

export async function buildAgendaPdf(input: AgendaPdfInput): Promise<AgendaPdfResult> {
  const canonical = canonicalize(input);
  const agendaHash = hashAgenda(canonical);

  const doc = new PDFDocument({ size: "LETTER", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Page 1: Cover sheet
  renderCoverPage(doc, input, agendaHash);

  // Page 2: Devotion (if set)
  if (input.devotionText) {
    renderDevotionPage(doc, input);
  }

  // Per-block lesson pages — blocks that have lesson OR generated content
  const contentBlocks = input.blocks.filter((b) => !!b.lesson || !!b.generated);
  for (const b of contentBlocks) {
    renderLessonPage(doc, input, b);
  }

  doc.end();
  await done;

  const pdfBuffer = Buffer.concat(chunks);
  return { pdfBuffer, canonicalText: canonical, agendaHash };
}
