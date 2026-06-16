/**
 * 2026-06-16 — Full worksheet PDF renderer.
 *
 * Turns a `WorksheetContent` (the same structure Reagan fills in online) into
 * a real, printable worksheet PDF with answer-line space, MC choices,
 * passages, and writing-prompt rows. Uploads to storage and returns the
 * signed `/manus-storage/...` url + a content hash (for Drive dedupe).
 *
 * Reuses the pdfkit styling conventions from agendaPdf.ts so the look matches
 * the rest of the printables.
 */
import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";
import { storagePut } from "../storage";
import { cleanForPdf } from "./agendaPdf";
import type { WorksheetContent, WorksheetItem } from "@shared/worksheetTypes";

const BRAND_GREEN = "#1f3a2e";
const GRAY_DARK = "#222222";
const GRAY_MID = "#555555";
const PAGE_W = 564;
const MARGIN = 48;

function answerLine(doc: PDFKit.PDFDocument, count = 1) {
  for (let i = 0; i < count; i++) {
    const x = MARGIN + 8;
    const y = doc.y + 12;
    doc
      .save()
      .strokeColor("#bbbbbb")
      .lineWidth(0.6)
      .moveTo(x, y)
      .lineTo(MARGIN + PAGE_W, y)
      .stroke()
      .restore();
    doc.y = y + 6;
  }
  doc.moveDown(0.3);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function renderItem(doc: PDFKit.PDFDocument, item: WorksheetItem, n: number) {
  ensureSpace(doc, 70);
  const label = item.kind === "passage" ? "" : `${n}. `;
  doc
    .fillColor(GRAY_DARK)
    .fontSize(item.kind === "passage" ? 10 : 11)
    .font(item.kind === "passage" ? "Helvetica-Oblique" : "Helvetica")
    .text(`${label}${cleanForPdf(item.prompt)}`, { width: PAGE_W });
  doc.moveDown(0.2);

  switch (item.kind) {
    case "passage":
      doc.moveDown(0.3);
      break;
    case "mc":
      (item.choices ?? []).forEach((c, i) => {
        doc
          .fillColor(GRAY_DARK)
          .fontSize(10)
          .font("Helvetica")
          .text(`   ${String.fromCharCode(65 + i)})  ${cleanForPdf(c)}`, { width: PAGE_W });
      });
      doc.moveDown(0.4);
      break;
    case "long":
      answerLine(doc, item.lines ?? 3);
      break;
    case "prompt":
      answerLine(doc, item.lines ?? 4);
      break;
    case "short":
    default:
      answerLine(doc, 1);
      break;
  }
}

/** Render the worksheet to a PDF Buffer. */
export function renderWorksheetPdfBuffer(
  content: WorksheetContent,
  opts: { dateLabel?: string; withAnswerKey?: boolean } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fillColor(BRAND_GREEN).fontSize(20).font("Helvetica-Bold").text(cleanForPdf(content.title), { width: PAGE_W });
      doc.moveDown(0.2);
      const meta: string[] = [];
      if (opts.dateLabel) meta.push(opts.dateLabel);
      if (content.bookRef) meta.push(content.bookRef);
      if (meta.length) {
        doc.fillColor(GRAY_MID).fontSize(9).font("Helvetica").text(cleanForPdf(meta.join("  ·  ")), { width: PAGE_W });
      }
      doc.fillColor(GRAY_MID).fontSize(9).font("Helvetica").text("Name: ______________________     Date: ____________", { width: PAGE_W });
      doc.moveDown(0.4);
      if (content.intro) {
        doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica-Oblique").text(cleanForPdf(content.intro), { width: PAGE_W });
        doc.moveDown(0.5);
      }

      // Sections
      let n = 1;
      for (const sec of content.sections) {
        ensureSpace(doc, 90);
        if (sec.heading) {
          doc.fillColor(BRAND_GREEN).fontSize(13).font("Helvetica-Bold").text(cleanForPdf(sec.heading), { width: PAGE_W });
          doc.moveDown(0.1);
        }
        if (sec.instructions) {
          doc.fillColor(GRAY_MID).fontSize(9.5).font("Helvetica-Oblique").text(cleanForPdf(sec.instructions), { width: PAGE_W });
          doc.moveDown(0.3);
        }
        for (const item of sec.items) {
          renderItem(doc, item, n);
          if (item.kind !== "passage") n++;
        }
        doc.moveDown(0.4);
      }

      // Optional answer key (for parents) on a fresh page
      if (opts.withAnswerKey) {
        const keyed = content.sections.flatMap((s) => s.items.filter((i) => i.answer));
        if (keyed.length) {
          doc.addPage();
          doc.fillColor(BRAND_GREEN).fontSize(14).font("Helvetica-Bold").text("Answer Key (for grown-ups)", { width: PAGE_W });
          doc.moveDown(0.4);
          let k = 1;
          for (const sec of content.sections) {
            for (const item of sec.items) {
              if (item.kind === "passage") continue;
              if (item.answer) {
                doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica").text(`${k}. ${cleanForPdf(item.answer)}`, { width: PAGE_W });
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
  opts: { forDate: string; printableId: number; withAnswerKey?: boolean } = { forDate: "", printableId: 0 },
): Promise<{ key: string; url: string; contentHash: string; fileName: string }> {
  const buf = await renderWorksheetPdfBuffer(content, {
    dateLabel: opts.forDate || undefined,
    withAnswerKey: opts.withAnswerKey ?? true,
  });
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const safeTitle = content.title.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40) || "worksheet";
  const fileName = `${safeTitle}_${opts.forDate || "today"}.pdf`;
  const key = `worksheets/${opts.forDate || "today"}/p${opts.printableId}_${contentHash.slice(0, 8)}.pdf`;
  const { key: storedKey, url } = await storagePut(key, buf, "application/pdf");
  return { key: storedKey, url, contentHash, fileName };
}
