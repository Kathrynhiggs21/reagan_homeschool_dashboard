/**
 * PrintWorksheetButton — 2026-06-18 (v2: fill-in + Drive)
 *
 * Per-block worksheet control. Reagan's worksheets come from IXL / Khan /
 * Education.com, which often hand back PDFs those sites can't reopen or fill.
 * This control gives two clear ways to actually work the sheet:
 *
 *   • "Open / Fill in PDF"  → generates (if needed) and opens the branded,
 *       0.5in-margin, answer-space PDF in a new tab. Reagan can print it, or
 *       fill it in with any PDF annotator and submit a photo back. Always
 *       available. Also files a copy to Google Drive when Drive is connected.
 *
 *   • "Open in Drive"       → deep-links to the annotatable Google Drive copy
 *       (drive.google.com/file/d/<id>/view) when the push has landed. If Drive
 *       isn't connected yet (no Drive credential), we say so honestly and open
 *       the fillable PDF instead — never a silent no-op.
 *
 * Backend (unchanged contract): worksheets.forBlock ensures content + returns
 * printableId; worksheets.makePdf renders the PDF, returns a signed url, files
 * to Drive, and now also returns { driveConnected, driveOpenUrl }.
 *
 * Adult-facing control (lives in the AgendaEditor block row). The underlying
 * mutations are protectedProcedure, so they require a signed-in adult session.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pencil, Loader2, ChevronDown, FileDown, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export interface PrintWorksheetButtonProps {
  /** YYYY-MM-DD date the block belongs to. */
  date: string;
  /** Plan-block id (string form of plans.blocks[].id). */
  blockId: string;
  /** Block title — seeds worksheet generation. */
  title: string;
  /** Optional subject slug for better generation + app linking. */
  subjectSlug?: string | null;
  /** Optional block type (used to detect non-academic blocks). */
  blockType?: string | null;
  /** Optional topic hint to steer the worksheet content. */
  topicHint?: string | null;
}

export function PrintWorksheetButton({
  date,
  blockId,
  title,
  subjectSlug,
  blockType,
  topicHint,
}: PrintWorksheetButtonProps) {
  const [busy, setBusy] = useState(false);
  const forBlock = trpc.worksheets.forBlock.useMutation();
  const makePdf = trpc.worksheets.makePdf.useMutation();

  /**
   * Shared pipeline: ensure the worksheet exists, render the PDF. Returns the
   * makePdf result (or null when the block has nothing to print). `win` is an
   * already-opened tab we navigate once we have a URL (so popups aren't
   * blocked). Pass mode="drive" to prefer the Drive copy.
   */
  async function buildAndOpen(mode: "pdf" | "drive") {
    if (busy) return;
    setBusy(true);
    // Open the tab synchronously so the browser doesn't block it as a popup;
    // we navigate it once the destination URL is ready.
    const win = window.open("", "_blank");
    try {
      const res = await forBlock.mutateAsync({
        date,
        blockId,
        title,
        subjectSlug: subjectSlug ?? undefined,
        blockType: blockType ?? undefined,
        topicHint: topicHint ?? undefined,
      });

      if (res.nonAcademic || !res.printableId) {
        if (win) win.close();
        toast.info("This block has no worksheet to fill in.");
        return;
      }

      const pdf = await makePdf.mutateAsync({
        printableId: res.printableId,
        date,
        withAnswerKey: true,
      });

      if (!pdf?.url) {
        if (win) win.close();
        toast.error("Couldn't build the worksheet PDF.");
        return;
      }

      // Decide destination.
      if (mode === "drive") {
        if (pdf.driveOpenUrl) {
          if (win) win.location.href = pdf.driveOpenUrl;
          else window.location.href = pdf.driveOpenUrl;
          toast.success("Opening the worksheet in Google Drive — fill it in and it saves there.");
          return;
        }
        // Drive requested but not available yet.
        if (win) win.location.href = pdf.url;
        else window.location.href = pdf.url;
        if (!pdf.driveConnected) {
          toast.info("Google Drive isn't connected yet — opened the fillable PDF instead.");
        } else {
          toast.info("Drive copy is still syncing — opened the fillable PDF for now.");
        }
        return;
      }

      // mode === "pdf"
      if (win) win.location.href = pdf.url;
      else window.location.href = pdf.url;
      toast.success(
        pdf.driveConnected
          ? "Worksheet PDF ready — also saved to Drive."
          : "Worksheet PDF ready to fill in or print.",
      );
    } catch (e: any) {
      if (win) win.close();
      toast.error(e?.message ?? "Couldn't open the worksheet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-stretch rounded-md shadow-sm" data-testid={`worksheet-actions-${blockId}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => buildAndOpen("pdf")}
        disabled={busy}
        className="h-8 gap-1.5 rounded-r-none bg-background/60"
        data-testid={`print-worksheet-${blockId}`}
        title="Open the fillable worksheet PDF (0.5in margins + answer space). Print it, or fill it in and submit a photo."
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
        {busy ? "Preparing…" : "Open / Fill in PDF"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-8 w-8 rounded-l-none border-l-0 bg-background/60 p-0"
            data-testid={`worksheet-actions-menu-${blockId}`}
            title="More ways to open this worksheet"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => buildAndOpen("pdf")} disabled={busy}>
            <FileDown className="mr-2 h-4 w-4" />
            Download / print PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => buildAndOpen("drive")} disabled={busy}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open in Google Drive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default PrintWorksheetButton;
