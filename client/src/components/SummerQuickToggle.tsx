import { trpc } from "@/lib/trpc";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { toast } from "sonner";
import { Sun } from "lucide-react";

/**
 * 2026-06-18 — SummerQuickToggle.
 *
 * An adult-only quick control to OPERATE summer mode, not just display it.
 * Reagan + Grandma already know it's summer, so this is a working switch
 * (per Mom: "v if it's an easy way to operate" — not a passive badge).
 *
 * Writes the single canonical `summer.override` key, which already cascades
 * everywhere through server/summerMode.effectiveSummerActive():
 *   - tutor-of-day suppression (Mom-only days)
 *   - the agenda assembler + nightly PDF/email
 *   - the kid-side "what's tomorrow?" choice chooser
 *
 * Three states map to the override value:
 *   "Auto"  → override = null   (follow the Jun 6 → Aug 15 window)
 *   "On"    → override = "on"   (force summer / Mom-only)
 *   "Off"   → override = "off"  (force a normal school day)
 *
 * Reagan can never reach this: the component is gated on useAdultLock(),
 * and the underlying prefs.set mutation is familyAdmin-only on the server.
 */

const DEFAULT_START = "06-06";
const DEFAULT_END = "08-15";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isInWindow(iso: string, start: string, end: string): boolean {
  const mmdd = iso.slice(5);
  return mmdd >= start && mmdd <= end;
}

type Mode = "auto" | "on" | "off";

export default function SummerQuickToggle() {
  const { unlocked } = useAdultLock();
  const utils = trpc.useUtils();

  const overrideQ = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.override" });
  const autoFlipQ = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.autoFlipEnabled" });
  const startQ = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.start" });
  const endQ = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.end" });

  const setPref = (trpc as any).prefs.set.useMutation({
    onSuccess: () => {
      utils.prefs.getPublic.invalidate();
    },
  });

  // Adult-only: never render for Reagan.
  if (!unlocked) return null;

  // Don't flash while the override value is still loading.
  if (overrideQ?.isLoading) return null;

  const ov = (overrideQ?.data ?? null) as string | null;
  const mode: Mode = ov === "on" ? "on" : ov === "off" ? "off" : "auto";

  // Compute what "Auto" currently resolves to, so the adult sees the effect.
  const iso = todayIso();
  const autoOn = ((autoFlipQ?.data ?? "1") as string) !== "0";
  const autoResolvesSummer =
    autoOn &&
    isInWindow(
      iso,
      ((startQ?.data as string) ?? DEFAULT_START),
      ((endQ?.data as string) ?? DEFAULT_END),
    );

  const effectiveActive = mode === "on" || (mode === "auto" && autoResolvesSummer);

  const apply = (next: Mode) => {
    const value = next === "auto" ? null : next; // "on" | "off" | null
    setPref.mutate(
      { key: "summer.override", value },
      {
        onSuccess: () => {
          const label =
            next === "auto"
              ? `Summer set to Auto (${autoResolvesSummer ? "summer right now" : "normal school day"})`
              : next === "on"
                ? "Summer mode forced ON — Mom-only days, no tutors"
                : "Summer mode forced OFF — normal school day";
          toast.success(label);
        },
        onError: () => toast.error("Couldn't change summer mode — try again."),
      },
    );
  };

  const btn = (m: Mode, text: string) => {
    const selected = mode === m;
    return (
      <button
        type="button"
        data-testid={`summer-quick-${m}`}
        aria-pressed={selected}
        disabled={setPref.isPending}
        onClick={() => apply(m)}
        className={[
          "px-2.5 py-1 text-xs font-semibold rounded-full transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          selected
            ? "bg-amber-400 text-amber-950 shadow-sm"
            : "bg-black/10 text-current hover:bg-black/20",
        ].join(" ")}
      >
        {text}
      </button>
    );
  };

  return (
    <div
      data-testid="summer-quick-toggle"
      className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-amber-100"
      title="Operate summer mode. This drives Mom-only days, tutor suppression, and the agenda/PDF."
    >
      <Sun className="w-4 h-4 text-amber-300 shrink-0" aria-hidden />
      <div className="flex flex-col leading-tight mr-1">
        <span className="text-xs font-semibold">Summer</span>
        <span className="text-[10px] opacity-80">
          {effectiveActive ? "On — Mom-only days" : "Off — school day"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {btn("auto", "Auto")}
        {btn("on", "On")}
        {btn("off", "Off")}
      </div>
    </div>
  );
}
