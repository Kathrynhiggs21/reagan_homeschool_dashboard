/**
 * printDailyAgendaContract.test.ts — v2.87 (2026-05-21)
 *
 * Mom asked: "for printable, I don't want to print homepage but the daily
 * agenda with all worksheets links for videos, descriptions etc of each
 * block." This contract test locks both halves of the rewire so a future
 * PR can't quietly revert it back to `window.print()`.
 *
 *  - Server side: `nightlyAgenda.printableNow` exists, takes a forDate,
 *    runs the same `assembleAgendaForDate` + `buildAgendaPdf` pipeline the
 *    nightly cron uses, and returns a base64 PDF.
 *  - Client side: Today.tsx uses <PrintAgendaButton/>, NOT window.print().
 *  - PrintAgendaButton: opens a Blob in a new tab, falls back to download
 *    when the popup is blocked.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTERS = path.join(__dirname, "routers.ts");
const TODAY_TSX = path.join(__dirname, "..", "client", "src", "pages", "Today.tsx");
const PRINT_BTN = path.join(
  __dirname, "..", "client", "src", "components", "PrintAgendaButton.tsx",
);
const AGENDA_PDF = path.join(__dirname, "_lib", "agendaPdf.ts");

describe("Print Daily Agenda contract (v2.87)", () => {
  describe("Server: nightlyAgenda.printableNow", () => {
    const src = fs.readFileSync(ROUTERS, "utf8");

    it("declares the printableNow procedure inside the nightlyAgenda router", () => {
      const i = src.indexOf("nightlyAgenda: router({");
      const j = src.indexOf("}),\n", i + 1); // walk to the next router close
      expect(i).toBeGreaterThan(-1);
      const block = src.slice(i, j > i ? j + 4000 : i + 8000);
      expect(block).toContain("printableNow:");
    });

    it("uses the same pipeline as the nightly cron (assembleAgendaForDate + buildAgendaPdf)", () => {
      const block = src.slice(src.indexOf("printableNow:"));
      expect(block.slice(0, 1500)).toContain('"./_lib/agendaAssembler"');
      expect(block.slice(0, 1500)).toContain('"./_lib/agendaPdf"');
      expect(block.slice(0, 1500)).toContain("assembleAgendaForDate");
      expect(block.slice(0, 1500)).toContain("buildAgendaPdf");
    });

    it("validates forDate as YYYY-MM-DD", () => {
      const block = src.slice(src.indexOf("printableNow:"));
      expect(block.slice(0, 800)).toMatch(
        /forDate:\s*z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//,
      );
    });

    it("returns base64 PDF + ok flag, plus a no_plan reason when assembly is empty", () => {
      const block = src.slice(src.indexOf("printableNow:"));
      const head = block.slice(0, 1500);
      expect(head).toContain('reason: "no_plan"');
      expect(head).toContain("pdfBase64:");
      expect(head).toContain('mime: "application/pdf"');
      expect(head).toContain("fileName:");
      expect(head).toContain("blockCount:");
    });
  });

  describe("Server: agendaPdf builder still emits link-rich block details", () => {
    // The PDF Mom prints must include block descriptions, video links,
    // worksheet links, and reading book pages — that's the whole point of
    // the rewire. agendaPdf.ts already renders these; lock that they stay.
    const pdf = fs.readFileSync(AGENDA_PDF, "utf8");

    it("renders block descriptions in the summary", () => {
      // The summary loop reads `b.description` and writes it.
      expect(pdf).toMatch(/description.*\?.*string|description\?\:\s*string/);
      // And actually renders it on the page (not just keeps the field).
      expect(pdf).toMatch(/b\.description/);
    });

    it("renders per-block video URLs and titles", () => {
      expect(pdf).toMatch(/videos\?\:\s*Array<\{[^}]*url:\s*string/);
      // The lesson-page loop walks the videos array.
      expect(pdf).toMatch(/L\.videos|input\.blocks.*videos/);
    });

    it("renders per-block worksheets with printable URLs", () => {
      expect(pdf).toMatch(/worksheets\?\:\s*Array<\{[^}]*printableUrl/);
      expect(pdf).toMatch(/L\.worksheets|input\.blocks.*worksheets/);
    });
  });

  describe("Client: Today header uses PrintAgendaButton (not window.print)", () => {
    const src = fs.readFileSync(TODAY_TSX, "utf8");

    it("imports PrintAgendaButton from @/components/PrintAgendaButton", () => {
      expect(src).toMatch(
        /import\s+PrintAgendaButton\s+from\s+["']@\/components\/PrintAgendaButton["']/,
      );
    });

    it("mounts <PrintAgendaButton/> with today's date", () => {
      expect(src).toMatch(/<PrintAgendaButton\s+forDate=\{todayDate\}\s*\/>/);
    });

    it("does NOT call window.print() directly anywhere", () => {
      expect(src).not.toContain("window.print()");
    });
  });

  describe("PrintAgendaButton component contract", () => {
    const src = fs.readFileSync(PRINT_BTN, "utf8");

    it("calls trpc nightlyAgenda.printableNow.fetch with forDate", () => {
      expect(src).toMatch(/nightlyAgenda\.printableNow\.fetch\(\{\s*forDate\s*\}\)/);
    });

    it("decodes base64 → Blob with application/pdf mime + opens in a new tab", () => {
      expect(src).toContain("atob(");
      expect(src).toMatch(/new Blob\(\[bytes\]/);
      expect(src).toMatch(/window\.open\(url, "_blank"\)/);
    });

    it("falls back to download when the popup is blocked", () => {
      expect(src).toMatch(/document\.createElement\("a"\)/);
      expect(src).toMatch(/a\.download = res\.fileName/);
    });

    it("toasts the no_plan and generic error cases", () => {
      expect(src).toContain('"no_plan"');
      expect(src).toMatch(/toast\.error/);
    });

    it("disables the button while loading + carries the print-daily-schedule-btn testid", () => {
      expect(src).toMatch(/disabled=\{loading\}/);
      expect(src).toContain('data-testid="print-daily-schedule-btn"');
    });
  });
});
