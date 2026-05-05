/**
 * NotebookDrawer — global slide-over panel for adult-only notebook tools.
 *
 * Shipped 2026-05-05. Replaces the standalone /agendas (Daily Schedule) page,
 * which only existed to host the day-picker + TutorDayNotesBox + plan summary.
 *
 * Behavior
 *  - A slim, vertical pill button sits on the mid-right edge of the viewport.
 *  - The pill is ONLY rendered when the adult-lock is unlocked, so the kid
 *    view stays clean and Reagan can never accidentally open it.
 *  - Position: `top: 50%` translated up half its height; `right: 0` flush to
 *    the edge with rounded-left corners. This keeps it well clear of the
 *    Quick-Add FAB (bottom-right) and the Kiwi perch (bottom-left), so it's
 *    not in the natural tap-path during normal use.
 *  - Tap → slide-over drawer (Sheet, side="right") containing the day picker
 *    + TutorDayNotesBox. Backdrop tap or X closes.
 *
 * If we ever add more notebook surfaces (e.g. a journal, behavior logs),
 * they can go inside this same drawer as tabs without changing the trigger.
 */
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { trpc } from "@/lib/trpc";
import TutorDayNotesBox from "@/components/TutorDayNotesBox";

export default function NotebookDrawer() {
  const { unlocked } = useAdultLock();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState<string>(today);

  // Tutor-of-day for the chosen date — tutor name auto-prefills the
  // TutorDayNotesBox author field.
  const tutorQ =
    (trpc as any).tutors?.tutorOfDay?.useQuery?.({ dateStr }) ?? {
      data: null,
      isLoading: false,
    };
  const tutorOfDayName: string | undefined =
    (tutorQ.data as any)?.name ?? undefined;

  if (!unlocked) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Mid-right edge pill — vertical text so it's narrow and unobtrusive.
            Stays out of the way of the Quick-Add FAB and Kiwi perch. */}
        <button
          type="button"
          aria-label="Open Notebook"
          title="Notebook"
          className="
            no-print
            fixed right-0 top-1/2 -translate-y-1/2 z-40
            flex flex-col items-center gap-1
            px-1.5 py-3
            rounded-l-lg
            border border-r-0 border-amber-300/50
            bg-amber-50 text-emerald-900 shadow-md
            hover:bg-amber-100 hover:shadow-lg
            transition-all
            text-[11px] font-semibold tracking-wide
          "
          style={{
            // Flat-against-edge: no horizontal travel needed to reach.
            writingMode: "vertical-rl",
            transform: "translateY(-50%) rotate(180deg)",
          }}
        >
          <span className="rotate-180" aria-hidden>
            📓
          </span>
          <span>Notebook</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl">📓 Notebook</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          {/* Day picker + tutor of the day inline */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Day</div>
              <Input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value || today)}
                className="w-44"
              />
            </div>
            <div className="ml-auto text-sm">
              {tutorOfDayName ? (
                <span>
                  <span className="text-muted-foreground">With Reagan: </span>
                  <span className="font-medium">{tutorOfDayName}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No tutor scheduled.</span>
              )}
            </div>
          </div>

          <TutorDayNotesBox
            dateStr={dateStr}
            tutorOfDayName={tutorOfDayName}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
