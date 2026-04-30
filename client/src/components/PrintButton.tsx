import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useCallback } from "react";

/**
 * Reusable print button.
 *
 * Two modes:
 *   1) `url`     — open the URL in a new tab so the browser print dialog can
 *                  trigger naturally (used for printable PDFs / images).
 *   2) `target`  — for "Print this finished work": pass a ref to the DOM node
 *                  that should be the only thing printed. We add a body class
 *                  so our @media print rules hide everything else.
 *
 * Falls back to `window.print()` of the whole page when neither is provided.
 */
export type PrintButtonProps = {
  /** PDF/image URL to open in a new tab and print */
  url?: string;
  /** DOM node to isolate-print (use ref.current) */
  targetEl?: HTMLElement | null;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  title?: string;
};

export default function PrintButton({
  url, targetEl, label = "Print", size = "sm", variant = "outline", className, title,
}: PrintButtonProps) {
  const onClick = useCallback(() => {
    if (url) {
      const win = window.open(url, "_blank", "noopener");
      if (win) {
        // Try to auto-trigger the print dialog once the new tab has loaded.
        win.addEventListener("load", () => { try { win.print(); } catch { /* noop */ } });
      }
      return;
    }
    if (targetEl) {
      // Mark this element so the print stylesheet can isolate it.
      targetEl.classList.add("print-finished-root");
      document.body.classList.add("printing-finished-only");
      const cleanup = () => {
        document.body.classList.remove("printing-finished-only");
        targetEl.classList.remove("print-finished-root");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      // Fallback cleanup in case afterprint never fires (Safari quirks).
      window.setTimeout(cleanup, 8000);
      window.print();
      return;
    }
    window.print();
  }, [url, targetEl]);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onClick}
      className={`no-print ${className || ""}`}
      title={title || (url ? "Open this printable and print it" : "Print this finished work")}
    >
      <Printer className="w-4 h-4 mr-1.5" />
      {label}
    </Button>
  );
}
