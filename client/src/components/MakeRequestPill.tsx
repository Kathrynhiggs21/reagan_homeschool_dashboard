/**
 * MakeRequestPill — push 54 (2026-05-13)
 *
 * Mom asked for a "request box that opens without requiring mic
 * activation or verbal prompts". The existing MakeRequestButton already
 * satisfies that contract (plain Textarea + chips, no mic permission, no
 * speech APIs), but it was only mounted in one place — the Today page
 * header. This wrapper renders a fixed-position bottom-left pill on every
 * kid page (locked state only — adults see the Notebook + admin tools
 * instead) so Reagan can always send a note no matter where she is in the
 * app.
 *
 * Hard rules:
   *   • Never touches navigator media APIs / speech APIs.
 *   • Never auto-opens. Reagan taps the pill, which calls the same
 *     kidRequests.create mutation under the hood.
 *   • Disappears whenever the adult lock is unlocked (Mom doesn't need it).
 *   • `print:hidden` + `.no-print` so it won't appear on printed packets.
 */
import { useAdultLock } from "@/contexts/AdultLockContext";
import { MakeRequestButton } from "@/components/MakeRequestButton";

export default function MakeRequestPill() {
  const { unlocked } = useAdultLock();
  // Adults already see the Notebook pill + admin tools — hide for them.
  if (unlocked) return null;

  return (
    <div
      className="
        no-print print:hidden
        fixed left-3 bottom-3 z-40
        sm:left-4 sm:bottom-4
      "
      // Use a wrapper rather than overriding MakeRequestButton's styling so
      // the existing dialog UX stays untouched.
      style={{ pointerEvents: "auto" }}
      data-testid="make-request-pill"
    >
      <MakeRequestButton />
    </div>
  );
}
