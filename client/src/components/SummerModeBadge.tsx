import { trpc } from "@/lib/trpc";

/**
 * Push 65 (2026-05-13) — Slice 5 summer-mode foundation.
 *
 * A small calm pill that shows up on Today when "summer mode" is
 * active. Mirrors the same priority order as
 * server/summerMode.effectiveSummerActive():
 *
 *   override "off" > vacation range > override "on" > auto window
 *
 * Self-hides when summer is not active (the "don't show if no info"
 * standing rule). Reads the 5 public summer.* keys via the existing
 * appSettings.getPublic route — no new procedure introduced.
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

function isInVacationJson(iso: string, raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    for (const r of parsed) {
      if (r?.start && r?.end && iso >= r.start && iso <= r.end) return true;
    }
  } catch {
    /* malformed JSON => treat as no ranges */
  }
  return false;
}

export default function SummerModeBadge() {
  // Five public summer.* keys, batched as individual queries.
  const autoFlip = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.autoFlipEnabled" });
  const start = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.start" });
  const end = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.end" });
  const override = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.override" });
  const vacationRanges = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.vacationRanges" });

  // Still loading any of them — render nothing rather than flash.
  if (
    autoFlip?.isLoading ||
    start?.isLoading ||
    end?.isLoading ||
    override?.isLoading ||
    vacationRanges?.isLoading
  ) {
    return null;
  }

  const ov = (override?.data ?? null) as string | null;
  const iso = todayIso();

  // Priority: override "off" > vacation > override "on" > auto window.
  if (ov === "off") return null;
  if (ov !== "on" && isInVacationJson(iso, vacationRanges?.data ?? null)) return null;
  let active = false;
  let reason: "manual-on" | "auto" | null = null;
  if (ov === "on") {
    active = true;
    reason = "manual-on";
  } else {
    const autoOn = (autoFlip?.data ?? "1") !== "0";
    if (autoOn && isInWindow(iso, (start?.data as string) ?? DEFAULT_START, (end?.data as string) ?? DEFAULT_END)) {
      active = true;
      reason = "auto";
    }
  }

  if (!active) return null; // don't show if no info — Mom's standing rule

  return (
    <div
      data-testid="summer-mode-badge"
      className="inline-flex items-center gap-2 rounded-full bg-amber-300/20 border border-amber-300/40 px-3 py-1 text-sm text-amber-100"
      title={
        reason === "manual-on"
          ? "Summer mode is on (Mom turned it on manually)."
          : "Summer mode is on (school's out — auto Jun 6 → Aug 15)."
      }
    >
      <span aria-hidden>☀️</span>
      <span className="font-medium">Summer mode</span>
      <span className="opacity-80">— choice block tonight</span>
    </div>
  );
}
