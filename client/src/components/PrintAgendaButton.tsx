/**
 * PrintAgendaButton.tsx — v2.87 (2026-05-21)
 *
 * The 🖨️ Print button in the Today header used to call window.print(), which
 * printed whatever was on the homepage. Mom asked for the FULL daily agenda
 * with each block's title, time, subject, description, lesson summary,
 * worksheet/video/practice links, book pages, and a notes area.
 *
 * We reuse the existing nightly-cron pipeline:
 *   `assembleAgendaForDate(date)` → `buildAgendaPdf(payload)` → PDF
 * via the new `nightlyAgenda.printableNow` query. The base64 PDF comes back,
 * we wrap it in a Blob, open it in a new tab, and let the browser's native
 * print dialog handle the actual printing.
 *
 * Behavior:
 *  - Click → fetches the PDF (loading spinner inside the button)
 *  - On `ok: true` → opens the PDF in a new tab; user can Cmd/Ctrl+P
 *  - On `ok: false` (no_plan) → toast "No plan for today yet — try again
 *    after the agenda is built"
 *  - Network/server error → toast with the error message
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Props {
  forDate: string; // YYYY-MM-DD
  className?: string;
}

export default function PrintAgendaButton({ forDate, className }: Props) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await utils.nightlyAgenda.printableNow.fetch({ forDate });
      if (!res.ok) {
        if (res.reason === "no_plan") {
          toast.error("No plan for today yet — build the agenda first.");
        } else {
          toast.error("Could not build the printable agenda.");
        }
        return;
      }
      // Decode base64 → Uint8Array → Blob, then open in a new tab so the
      // browser's native print/save dialog picks it up.
      const binary = atob(res.pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.mime });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        // Pop-up blocked — fall back to a download.
        const a = document.createElement("a");
        a.href = url;
        a.download = res.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.message("Pop-up was blocked — downloading instead.");
      }
      // Best-effort cleanup; the open tab keeps a reference so revoking
      // immediately can break the preview in some browsers. Defer.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast.error(err?.message || "Could not build the printable agenda.");
    } finally {
      setLoading(false);
    }
  }, [forDate, loading, utils]);

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={loading}
      className={className ?? "bg-white/80 hover:bg-white"}
      title="Print the full daily agenda — block details, worksheets, videos, links, and a notes area"
      data-testid="print-daily-schedule-btn"
    >
      {loading ? "🖨️ Building…" : "🖨️ Print Daily Agenda"}
    </Button>
  );
}
