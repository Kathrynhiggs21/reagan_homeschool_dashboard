/**
 * ReadyFor6thBadge
 *
 * Self-contained summer-mode detector + 6th grade readiness indicator.
 * Mirrors the same prefs-key logic as SummerModeBadge so it self-hides
 * when summer mode is not active.
 *
 * Shows per-subject mastery bars (≥ 75% = ready).
 * Shows a "Ready for 6th Grade!" banner when all 4 core subjects are ready.
 */
import { trpc } from "@/lib/trpc";

const DEFAULT_START = "06-01";
const DEFAULT_END = "08-31";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isInWindow(iso: string, start: string, end: string): boolean {
  const mmdd = iso.slice(5); // "MM-DD"
  return mmdd >= start && mmdd <= end;
}

function isInVacationJson(iso: string, raw: unknown): boolean {
  if (!raw || typeof raw !== "string") return false;
  try {
    const ranges: { start: string; end: string }[] = JSON.parse(raw);
    return ranges.some((r) => iso >= r.start && iso <= r.end);
  } catch {
    return false;
  }
}

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  science: "Science",
  ss: "Social Studies",
};

export default function ReadyFor6thBadge() {
  // Summer mode prefs (same keys as SummerModeBadge)
  const autoFlip = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.autoFlipEnabled" });
  const start = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.start" });
  const end = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.end" });
  const override = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.override" });
  const vacationRanges = (trpc as any).prefs?.getPublic?.useQuery?.({ key: "summer.vacationRanges" });

  // Determine if summer mode is active
  const prefsLoading =
    autoFlip?.isLoading ||
    start?.isLoading ||
    end?.isLoading ||
    override?.isLoading ||
    vacationRanges?.isLoading;

  let summerActive = false;
  if (!prefsLoading) {
    const ov = (override?.data ?? null) as string | null;
    const iso = todayIso();
    if (ov === "on") {
      summerActive = true;
    } else if (ov !== "off" && !isInVacationJson(iso, vacationRanges?.data ?? null)) {
      const autoOn = (autoFlip?.data ?? "1") !== "0";
      if (
        autoOn &&
        isInWindow(
          iso,
          (start?.data as string) ?? DEFAULT_START,
          (end?.data as string) ?? DEFAULT_END
        )
      ) {
        summerActive = true;
      }
    }
  }

  const { data, isLoading } = (trpc.skillLadder as any).readyFor6th.useQuery(undefined, {
    staleTime: 60_000,
    enabled: summerActive,
  });

  if (!summerActive || prefsLoading || isLoading || !data) return null;

  const { allReady, avgPct, subjects } = data as {
    allReady: boolean;
    avgPct: number;
    threshold: number;
    subjects: { subjectSlug: string; pctMastered: number; ready: boolean }[];
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm no-print ${
        allReady
          ? "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-amber-300/40 bg-amber-50 dark:bg-amber-950/20"
      }`}
      data-testid="ready-for-6th-badge"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-foreground">
          {allReady ? "🎉 Ready for 6th Grade!" : "📈 6th Grade Readiness"}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{avgPct}% avg</span>
      </div>
      <div className="space-y-1.5">
        {subjects.map((s) => (
          <div key={s.subjectSlug} className="flex items-center gap-2">
            <span className="w-28 text-xs text-muted-foreground shrink-0">
              {SUBJECT_LABELS[s.subjectSlug] ?? s.subjectSlug}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  s.ready
                    ? "bg-emerald-500"
                    : s.pctMastered >= 50
                    ? "bg-amber-400"
                    : "bg-rose-400"
                }`}
                style={{ width: `${Math.min(100, s.pctMastered)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-8 text-right">
              {s.pctMastered}%
            </span>
            {s.ready && <span className="text-emerald-500 text-xs">✓</span>}
          </div>
        ))}
      </div>
      {!allReady && (
        <p className="text-xs text-muted-foreground mt-2">
          Each subject needs ≥ 75% mastery to unlock 6th grade preview mode.
        </p>
      )}
    </div>
  );
}
