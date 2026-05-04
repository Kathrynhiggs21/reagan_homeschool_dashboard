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
  bookPageRefs?: Array<{ bookTitle: string; fromPage: number; toPage: number }>;
  printablesAttached?: number;
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
      b.curriculumTopicCode ? `(${b.curriculumTopicCode})` : "",
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
      (b.curriculumTopicCode ? `  ·  topic ${b.curriculumTopicCode}` : "");
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

  // Footer
  doc.moveDown(0.8);
  doc.fillColor("#888").fontSize(8).text(`Hash: ${agendaHash.slice(0, 16)}…  ·  Generated for ${input.forDate}`);

  doc.end();
  await done;

  const pdfBuffer = Buffer.concat(chunks);
  return { pdfBuffer, canonicalText: canonical, agendaHash };
}
