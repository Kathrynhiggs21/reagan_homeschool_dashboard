/**
 * Nightly Agenda PDF builder.
 *
 * Composes a simple, plain-language one-pager that Mom (Marcy / spear.cpt) can
 * print or hand to whoever's covering the day. Block list mirrors what the
 * Daily Schedule page shows, with:
 *   - Date + tutor of the day (with arrival/departure)
 *   - Numbered blocks with start time, duration, subject, title
 *   - Page-spans for printed books written inline ("Read pg. 31–35 of …")
 *   - Tutor day notes (carry-forward from the prior day if present)
 *   - Footer with sha256 hash so the email recipient can spot if the agenda
 *     changed between 8 PM and school start.
 *
 * No external services here — purely PDF bytes + a canonical text snapshot.
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
  /** Push 30 (2026-05-13): plain-language topic title shown alongside the code
   *  on the agenda head + lesson page header so tutors don't need to look up
   *  what "5.OA.1" means. Optional for back-compat — existing payloads
   *  rendered without it still hash identically. */
  curriculumTopicTitle?: string | null;
  bookPageRefs?: Array<{ bookTitle: string; fromPage: number; toPage: number }>;
  printablesAttached?: number;
  /**
   * 2026-05-05 — full self-contained lesson content. When present, the PDF
   * also renders one lesson page per block AFTER the summary page so the
   * print-out is usable without any dashboard access.
   */
  lesson?: {
    instructions?: string | null;
    objectives?: string[] | null;
    materials?: string[] | null;
    videos?: Array<{ title: string; url: string; description?: string | null; transcript?: string | null }>;
    worksheets?: Array<{ title: string; description?: string | null; questions?: string[] | null; printableUrl?: string | null }>;
    answerKey?: string | null;
  } | null;
  /**
   * Push 74 (2026-05-13) — operable + printable per-type block payload
   * from server/_lib/blockGenerators. Optional and back-compat: legacy
   * blocks rendered before this field existed still hash identically
   * because canonicalize() only includes fields it knows about.
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
  for (const b of input.blocks) {
    const parts = [
      `#${b.sortOrder}`,
      b.startTime ? `@${b.startTime}` : "@flex",
      `${b.durationMin}m`,
      b.subjectName ? `[${b.subjectName}]` : "",
      // Push 30: only stamp the topic title in canonical text when it's
      // both present AND a code exists — keeps hashes stable for blocks that
      // never had a topic at all.
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

/* ---------------------------- pdf rendering ------------------------------- */

export async function buildAgendaPdf(input: AgendaPdfInput): Promise<AgendaPdfResult> {
  const canonical = canonicalize(input);
  const agendaHash = hashAgenda(canonical);

  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Header
  doc.fillColor("#1f3a2e").fontSize(20).text(`${input.studentName}'s School Day`, { continued: false });
  doc.moveDown(0.2);
  doc.fillColor("#444").fontSize(13).text(input.dayLabel);
  if (input.tutorName) {
    doc.moveDown(0.2);
    const tutorLine = `Tutor: ${input.tutorName}` +
      (input.tutorArrival ? ` · Arrives ${input.tutorArrival}` : "") +
      (input.tutorDeparture ? ` · Leaves ${input.tutorDeparture}` : "");
    doc.fillColor("#0a66c2").fontSize(12).text(tutorLine);
  }
  if (input.schoolDayWindow) {
    doc.fillColor("#666").fontSize(10).text(`School-day window: ${input.schoolDayWindow.start} – ${input.schoolDayWindow.end}`);
  }
  doc.moveDown(0.6);
  doc.strokeColor("#ddd").moveTo(48, doc.y).lineTo(564, doc.y).stroke();
  doc.moveDown(0.6);

  // Blocks
  doc.fillColor("#1f3a2e").fontSize(14).text("Today's plan", { underline: false });
  doc.moveDown(0.3);
  if (input.blocks.length === 0) {
    doc.fillColor("#999").fontSize(11).text("No blocks scheduled.");
  }
  for (const b of input.blocks) {
    const head = `${b.sortOrder}. ${b.startTime ?? "flex"} · ${b.durationMin} min · ${b.subjectName ?? "any"}` +
      (b.curriculumTopicCode
        ? (b.curriculumTopicTitle
            ? `  ·  ${b.curriculumTopicCode}  ·  ${b.curriculumTopicTitle}`
            : `  ·  topic ${b.curriculumTopicCode}`)
        : "");
    doc.fillColor("#222").fontSize(11).text(head);
    doc.fillColor("#000").fontSize(12).text(`   ${b.title}`);
    if (b.description) {
      doc.fillColor("#444").fontSize(10).text(`   ${b.description.trim()}`, { width: 500 });
    }
    if (b.bookPageRefs?.length) {
      for (const r of b.bookPageRefs) {
        doc.fillColor("#0a66c2").fontSize(10).text(`   📖 ${r.bookTitle} — pg. ${r.fromPage}–${r.toPage}`);
      }
    }
    if ((b.printablesAttached ?? 0) > 0) {
      doc.fillColor("#27ae60").fontSize(10).text(`   📎 ${b.printablesAttached} printable(s) attached to email`);
    }
    // Push 76 (2026-05-13) — surface generated payload (single calm line)
    // on the summary page when there's no description and no book page refs
    // already, so adults see "🎯 Practice — 4 problems" / "🌟 Adventure …"
    // without flipping to the addendum page.
    if (b.generated && !b.description && !(b.bookPageRefs && b.bookPageRefs.length > 0)) {
      const kindIcon = b.generated.kind === "reading" ? "📖" :
                       b.generated.kind === "adventure" ? "🌟" : "🎯";
      doc.fillColor("#7a4d00").fontSize(10).text(`   ${kindIcon} ${b.generated.printable}`);
    }
    doc.moveDown(0.5);
  }

  // Yesterday's tutor notes carry-forward
  if (input.tutorNotesYesterday) {
    doc.moveDown(0.4);
    doc.strokeColor("#ddd").moveTo(48, doc.y).lineTo(564, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fillColor("#1f3a2e").fontSize(13).text("From yesterday's tutor");
    doc.fillColor("#222").fontSize(11).text(`${input.tutorNotesYesterday.tutorName}: ${input.tutorNotesYesterday.notes.trim()}`, { width: 500 });
  }

  // Footer for summary page
  doc.moveDown(0.8);
  doc.fillColor("#888").fontSize(8).text(`Hash: ${agendaHash.slice(0, 16)}…  ·  Generated for ${input.forDate}`);

  /* ----------------------------------------------------------------------
   * 2026-05-05 — Self-contained lesson pages.
   * One page per block that has a `lesson` payload, so the printed packet
   * is a complete day even without dashboard access.
   * -------------------------------------------------------------------- */
  /* ----------------------------------------------------------------------
   * Push 76 (2026-05-13) — Generated payload addendum pages.
   * One page per block that has a `generated` payload but NO `lesson` (so
   * we don't double-render the same block). Keeps the printed packet
   * self-contained: instructions, supply list, printable, operable URL.
   * -------------------------------------------------------------------- */
  const generatedBlocks = input.blocks.filter((b) => !!b.generated && !b.lesson);
  for (const b of generatedBlocks) {
    doc.addPage();
    doc.fillColor("#1f3a2e").fontSize(16).text(`${b.sortOrder}. ${b.title}`);
    doc.fillColor("#666").fontSize(10).text(
      [
        b.startTime ? b.startTime : "flex",
        `${b.durationMin} min`,
        b.subjectName ?? "any",
        b.generated!.kind,
      ].filter(Boolean).join("  ·  "),
    );
    doc.moveDown(0.4);
    doc.strokeColor("#ddd").moveTo(48, doc.y).lineTo(564, doc.y).stroke();
    doc.moveDown(0.4);

    const G = b.generated!;
    doc.fillColor("#1f3a2e").fontSize(12).text("What to do");
    for (const step of G.instructions) {
      doc.fillColor("#222").fontSize(10).text(`• ${step}`, { width: 500 });
    }
    doc.moveDown(0.3);

    if (G.operable.supplyList && G.operable.supplyList.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Supplies");
      for (const s of G.operable.supplyList) {
        doc.fillColor("#222").fontSize(10).text(`• ${s}`, { width: 500 });
      }
      doc.moveDown(0.3);
    }

    doc.fillColor("#1f3a2e").fontSize(12).text("Printable");
    doc.fillColor("#000").fontSize(11).text(G.printable, { width: 500 });
    doc.moveDown(0.3);

    if (G.operable.url) {
      doc.fillColor("#0a66c2").fontSize(10).text(`Open: ${G.operable.url}`, {
        link: G.operable.url,
        underline: true,
      });
    }

    // Footer text — NOT pinned to y=740 (which can overflow into a new page);
    // a small moveDown + text keeps it on the same addendum page.
    doc.moveDown(0.4);
    doc.fillColor("#888").fontSize(8).text(
      `Block ${b.sortOrder} of ${input.blocks.length}  ·  ${input.forDate}`,
    );
  }

  const lessonBlocks = input.blocks.filter((b) => !!b.lesson);
  for (const b of lessonBlocks) {
    doc.addPage();
    // Page header
    doc.fillColor("#1f3a2e").fontSize(16).text(`${b.sortOrder}. ${b.title}`);
    doc.fillColor("#666").fontSize(10).text(
      [
        b.startTime ? b.startTime : "flex",
        `${b.durationMin} min`,
        b.subjectName ?? "any",
        b.curriculumTopicCode
          ? (b.curriculumTopicTitle
              ? `${b.curriculumTopicCode} · ${b.curriculumTopicTitle}`
              : `topic ${b.curriculumTopicCode}`)
          : null,
      ].filter(Boolean).join("  ·  "),
    );
    doc.moveDown(0.4);
    doc.strokeColor("#ddd").moveTo(48, doc.y).lineTo(564, doc.y).stroke();
    doc.moveDown(0.4);

    const L = b.lesson!;
    if (L.objectives && L.objectives.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Objectives");
      for (const o of L.objectives) {
        doc.fillColor("#222").fontSize(10).text(`• ${o}`, { width: 500 });
      }
      doc.moveDown(0.4);
    }
    if (L.materials && L.materials.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Materials");
      for (const m of L.materials) {
        doc.fillColor("#222").fontSize(10).text(`• ${m}`, { width: 500 });
      }
      doc.moveDown(0.4);
    }
    if (L.instructions) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Instructions");
      doc.fillColor("#222").fontSize(10).text(L.instructions.trim(), { width: 500 });
      doc.moveDown(0.4);
    }
    if (L.videos && L.videos.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Videos");
      for (const v of L.videos) {
        doc.fillColor("#0a66c2").fontSize(10).text(`▶ ${v.title}`, { link: v.url, underline: true });
        if (v.description) {
          doc.fillColor("#444").fontSize(9).text(v.description.trim(), { width: 500 });
        }
        if (v.transcript) {
          doc.fillColor("#666").fontSize(8).text(`Transcript: ${v.transcript.trim().slice(0, 1200)}${v.transcript.length > 1200 ? "…" : ""}`, { width: 500 });
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.2);
    }
    if (L.worksheets && L.worksheets.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(12).text("Worksheet");
      for (const w of L.worksheets) {
        doc.fillColor("#000").fontSize(11).text(w.title);
        if (w.description) {
          doc.fillColor("#444").fontSize(9).text(w.description.trim(), { width: 500 });
        }
        if (w.questions && w.questions.length > 0) {
          doc.moveDown(0.2);
          for (let i = 0; i < w.questions.length; i++) {
            doc.fillColor("#222").fontSize(10).text(`${i + 1}. ${w.questions[i]}`, { width: 500 });
            // answer line so it's writable on paper
            doc.fillColor("#999").fontSize(10).text("_______________________________________________________________________", { width: 500 });
            doc.moveDown(0.15);
          }
        }
        if (w.printableUrl) {
          doc.fillColor("#0a66c2").fontSize(9).text(`Printable: ${w.printableUrl}`, { link: w.printableUrl, underline: true });
        }
        doc.moveDown(0.3);
      }
    }
    if (L.answerKey) {
      doc.moveDown(0.2);
      doc.fillColor("#888").fontSize(8).text(`Answer key (adult): ${L.answerKey.trim()}`, { width: 500 });
    }
    // page footer
    doc.fillColor("#888").fontSize(8).text(`Block ${b.sortOrder} of ${input.blocks.length}  ·  ${input.forDate}`, 48, 740);
  }

  doc.end();
  await done;

  const pdfBuffer = Buffer.concat(chunks);
  return { pdfBuffer, canonicalText: canonical, agendaHash };
}
