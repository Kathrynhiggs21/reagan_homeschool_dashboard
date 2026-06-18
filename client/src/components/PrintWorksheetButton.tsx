/**
 * PrintWorksheetButton — 2026-06-18
 *
 * One-tap "Print worksheet" for a single schedule block. Reuses the existing
 * worksheets backend (no new procedures):
 *   1. worksheets.forBlock  → ensures/generates the worksheet content and
 *      returns the backing `printableId` (non-academic blocks return null).
 *   2. worksheets.makePdf   → renders the PDF, returns a signed download URL,
 *      and files the PDF to Google Drive (reagan_assignments) automatically.
 *
 * The PDF opens in a new tab when ready. Non-academic blocks (lunch/breaks/
 * appointments) hide the button entirely since there is nothing to print.
 *
 * Adult-facing control (lives in the AgendaEditor block row). The underlying
 * mutations are protectedProcedure, so they require a signed-in adult session.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
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

  async function handlePrint() {
    if (busy) return;
    setBusy(true);
    // Open the tab synchronously so the browser doesn't block it as a popup;
    // we navigate it once the PDF URL is ready.
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
        toast.info("This block has no worksheet to print.");
        return;
      }

      const pdf = await makePdf.mutateAsync({
        printableId: res.printableId,
        date,
        withAnswerKey: true,
      });

      if (pdf?.url) {
        if (win) {
          win.location.href = pdf.url;
        } else {
          // Popup was blocked — fall back to a same-tab navigation.
          window.location.href = pdf.url;
        }
        toast.success("Worksheet PDF ready — also saved to Drive.");
      } else {
        if (win) win.close();
        toast.error("Couldn't build the worksheet PDF.");
      }
    } catch (e: any) {
      if (win) win.close();
      toast.error(e?.message ?? "Couldn't print the worksheet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handlePrint}
      disabled={busy}
      className="h-8 gap-1.5 bg-background/60"
      data-testid={`print-worksheet-${blockId}`}
      title="Generate a printable worksheet PDF for this block (also saved to Drive)"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Printer className="h-3.5 w-3.5" />
      )}
      {busy ? "Preparing…" : "Print worksheet"}
    </Button>
  );
}

export default PrintWorksheetButton;
