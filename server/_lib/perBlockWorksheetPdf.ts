/**
 * Per-block worksheet PDF builder (PRIORITY-1, 2026-05-14).
 *
 * The nightly /api/scheduled/nightly-agenda-email endpoint already emits one
 * combined agenda PDF, but Mom asked for the *individual* worksheets to show
 * up as real attachments in Gmail (not just one big agenda PDF). This helper
 * splits a single agenda payload into one PDF per block-that-has-a-worksheet,
 * using kid-readable headings ("What to do", "Try these", "Answers (for Mom)")
 * instead of "Objectives / Instructions / Answer key".
 *
 * Shape mirrors AgendaPdfInput so callers can pass the same payload they pass
 * to buildAgendaPdf().
 *
 * Pure-ish: Node-only (pdfkit). No DB/IO. Returns Buffers + suggested filenames
 * the scheduled-task agent can attach directly to the Gmail send.
 */
import PDFDocument from "pdfkit";
import type { AgendaPdfBlock, AgendaPdfInput } from "./agendaPdf";

export type PerBlockWorksheetAttachment = {
  /** Suggested filename Mom + Grandma will see in Gmail. */
  filename: string;
  /** Stable per-day key the scheduled task can de-dup on. */
  attachmentKey: string;
  blockSortOrder: number;
  blockId: number | null;
  subjectName: string | null;
  topicCode: string | null;
  pdfBuffer: Buffer;
  /** byte length, surfaced for logging + 25 MB Gmail cap pre-check. */
  byteSize: number;
};

const KID_HEADINGS = {
  whatToDo: "What to do",
  questions: "Try these",
  supplies: "What you need",
  answers: "Answers (for Mom)",
  videos: "Watch this first",
} as const;

function safeFilename(s: string, max = 60): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Returns true if this block has *something printable* worth its own PDF. */
export function blockHasPrintable(b: AgendaPdfBlock): boolean {
  if (b.lesson) {
    const w = b.lesson.worksheets ?? [];
    if (w.length > 0) return true;
    if ((b.lesson.instructions ?? "").trim().length > 0) return true;
    if ((b.lesson.objectives ?? []).length > 0) return true;
  }
  if (b.generated) {
    if ((b.generated.instructions ?? []).length > 0) return true;
    if ((b.generated.printable ?? "").trim().length > 0) return true;
  }
  return false;
}

function suggestFilename(
  forDate: string,
  b: AgendaPdfBlock,
  studentName: string,
): string {
  const parts: string[] = [];
  parts.push(forDate);
  parts.push(`Block${b.sortOrder}`);
  if (b.subjectName) parts.push(safeFilename(b.subjectName));
  parts.push(safeFilename(b.title, 40) || "Worksheet");
  parts.push(safeFilename(studentName, 12));
  return parts.filter(Boolean).join(" - ") + ".pdf";
}

function attachmentKey(forDate: string, b: AgendaPdfBlock): string {
  return [
    forDate,
    `b${b.sortOrder}`,
    b.curriculumTopicCode ?? "no-topic",
    b.subjectName ? safeFilename(b.subjectName, 16) : "no-subj",
  ].join("/");
}

function renderOneBlock(
  doc: PDFKit.PDFDocument,
  input: AgendaPdfInput,
  b: AgendaPdfBlock,
): void {
  // Big kid-readable header
  doc.fillColor("#1f3a2e").fontSize(22).text(b.title, { align: "left" });
  doc.moveDown(0.15);
  doc.fillColor("#666").fontSize(12).text(
    [
      input.dayLabel,
      b.startTime ? `Start: ${b.startTime}` : "Start: when you're ready",
      `${b.durationMin} minutes`,
      b.subjectName ?? null,
    ]
      .filter(Boolean)
      .join("  ·  "),
  );
  if (b.curriculumTopicCode || b.curriculumTopicTitle) {
    doc.fillColor("#888").fontSize(10).text(
      [b.curriculumTopicCode, b.curriculumTopicTitle].filter(Boolean).join(" · "),
    );
  }
  doc.moveDown(0.3);
  doc.strokeColor("#ddd").moveTo(48, doc.y).lineTo(564, doc.y).stroke();
  doc.moveDown(0.4);

  if (b.description) {
    doc.fillColor("#222").fontSize(12).text(b.description.trim(), { width: 500 });
    doc.moveDown(0.3);
  }

  // Lesson-style payload
  if (b.lesson) {
    const L = b.lesson;
    if (L.materials && L.materials.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.supplies);
      for (const m of L.materials) {
        doc.fillColor("#222").fontSize(11).text(`• ${m}`, { width: 500 });
      }
      doc.moveDown(0.3);
    }
    if (L.videos && L.videos.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.videos);
      for (const v of L.videos) {
        doc.fillColor("#0a66c2").fontSize(11).text(`▶ ${v.title}`, {
          link: v.url,
          underline: true,
        });
        if (v.description) {
          doc.fillColor("#444").fontSize(10).text(v.description.trim(), {
            width: 500,
          });
        }
      }
      doc.moveDown(0.3);
    }
    if (L.instructions && L.instructions.trim().length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.whatToDo);
      doc.fillColor("#222").fontSize(11).text(L.instructions.trim(), {
        width: 500,
      });
      doc.moveDown(0.3);
    }
    if (L.worksheets && L.worksheets.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.questions);
      for (const w of L.worksheets) {
        if (w.title) {
          doc.fillColor("#222").fontSize(12).text(w.title);
        }
        if (w.description) {
          doc.fillColor("#666").fontSize(10).text(w.description.trim(), {
            width: 500,
          });
        }
        const qs = w.questions ?? [];
        if (qs.length > 0) {
          doc.moveDown(0.2);
          for (let i = 0; i < qs.length; i++) {
            doc.fillColor("#222").fontSize(11).text(`${i + 1}. ${qs[i]}`, {
              width: 500,
            });
            doc.fillColor("#bbb").fontSize(11).text(
              "________________________________________________________",
              { width: 500 },
            );
            doc.moveDown(0.15);
          }
        }
      }
    }
    if (L.answerKey && L.answerKey.trim().length > 0) {
      doc.moveDown(0.3);
      doc.fillColor("#1f3a2e").fontSize(12).text(KID_HEADINGS.answers);
      doc.fillColor("#444").fontSize(10).text(L.answerKey.trim(), {
        width: 500,
      });
    }
  }

  // Generated-style payload (adventure / practice / reading)
  if (b.generated) {
    const G = b.generated;
    if (G.kind === "adventure" && G.instructions[0]) {
      doc.fillColor("#7a4d00").fontSize(11).text(`Safety: ${G.instructions[0]}`, {
        width: 500,
      });
      doc.moveDown(0.2);
    }
    const stepsToRender =
      G.kind === "adventure" ? G.instructions.slice(1) : G.instructions;
    if (stepsToRender.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.whatToDo);
      for (const step of stepsToRender) {
        doc.fillColor("#222").fontSize(11).text(`• ${step}`, { width: 500 });
      }
      doc.moveDown(0.3);
    }
    if (G.operable.supplyList && G.operable.supplyList.length > 0) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.supplies);
      for (const s of G.operable.supplyList) {
        doc.fillColor("#222").fontSize(11).text(`• ${s}`, { width: 500 });
      }
      doc.moveDown(0.3);
    }
    if (G.printable) {
      doc.fillColor("#1f3a2e").fontSize(13).text(KID_HEADINGS.questions);
      doc.fillColor("#222").fontSize(11).text(G.printable, { width: 500 });
    }
    if (G.operable.url) {
      doc.moveDown(0.3);
      doc.fillColor("#0a66c2").fontSize(10).text(`Open online: ${G.operable.url}`, {
        link: G.operable.url,
        underline: true,
      });
    }
  }

  // Footer
  doc.moveDown(0.5);
  doc.fillColor("#888").fontSize(9).text(
    `Block ${b.sortOrder} · ${input.studentName} · ${input.forDate}`,
  );
}

async function renderSingleBlockPdf(
  input: AgendaPdfInput,
  b: AgendaPdfBlock,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));
  renderOneBlock(doc, input, b);
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

export interface BuildPerBlockWorksheetAttachmentsOptions {
  /**
   * Hard cap on combined attachment size in bytes. Gmail's hard limit is
   * 25 MB across ALL attachments. Default 20 MB to leave headroom for the
   * agenda PDF itself.
   */
  maxTotalBytes?: number;
  /** Map block.sortOrder -> blockId from the database for traceability. */
  blockIdBySortOrder?: Record<number, number>;
}

/**
 * Build one PDF per block-with-printable. Returns the attachments in
 * sortOrder order. Skips blocks with nothing to print. Honors a soft size
 * cap by trimming from the END of the day (later-block first) until the
 * total fits — that way the morning's worksheets always make it through.
 */
export async function buildPerBlockWorksheetAttachments(
  input: AgendaPdfInput,
  opts: BuildPerBlockWorksheetAttachmentsOptions = {},
): Promise<PerBlockWorksheetAttachment[]> {
  const printableBlocks = input.blocks
    .filter(blockHasPrintable)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const out: PerBlockWorksheetAttachment[] = [];
  for (const b of printableBlocks) {
    const pdfBuffer = await renderSingleBlockPdf(input, b);
    out.push({
      filename: suggestFilename(input.forDate, b, input.studentName),
      attachmentKey: attachmentKey(input.forDate, b),
      blockSortOrder: b.sortOrder,
      blockId: opts.blockIdBySortOrder?.[b.sortOrder] ?? null,
      subjectName: b.subjectName ?? null,
      topicCode: b.curriculumTopicCode ?? null,
      pdfBuffer,
      byteSize: pdfBuffer.byteLength,
    });
  }

  const cap = Math.max(1, opts.maxTotalBytes ?? 20 * 1024 * 1024);
  let total = out.reduce((s, a) => s + a.byteSize, 0);
  while (total > cap && out.length > 0) {
    const dropped = out.pop()!;
    total -= dropped.byteSize;
  }
  return out;
}
