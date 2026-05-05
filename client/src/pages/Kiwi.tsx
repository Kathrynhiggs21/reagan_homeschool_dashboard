/**
 * Kiwi — consolidated kid page (2026-05-05)
 *
 * Replaces the two separate /coins and /practice pages with ONE page per
 * Mom's request:
 *   • Top strip: big coin total on the left, "Email Mom & Grandma to redeem"
 *     button on the right. NO grey, NO card chrome, NO prize ladder, NO list
 *     of current prizes.
 *   • Below: Practice activities grouped by subject. Each subject is its own
 *     coloured panel using the same subject color tokens Today already uses.
 *     Finder-style view-mode toggle (Icon / List / Column) at the top right of
 *     the Practice section. Kid-remembered via localStorage. Default = Icon.
 *   • Hide-if-empty per subject. If kid has 0 practice activities total AND 0
 *     coins, the whole Practice section hides (top strip still shows the
 *     email button so an adult can still redeem manually).
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutGrid, List, Columns } from "lucide-react";

type ViewMode = "icon" | "list" | "column";

const VIEW_MODE_KEY = "kiwi-page-view-mode";

// Subject colour tokens. Matches the warm/colored palette used on Today so
// the kid sees the same colour for the same subject everywhere.
const SUBJECT_COLOR: Record<string, { bg: string; ring: string; ink: string; chip: string }> = {
  math:     { bg: "bg-sky-100 dark:bg-sky-950/40",       ring: "ring-sky-400",     ink: "text-sky-900 dark:text-sky-100",         chip: "bg-sky-200 dark:bg-sky-800 text-sky-900 dark:text-sky-100" },
  ela:      { bg: "bg-amber-100 dark:bg-amber-950/40",   ring: "ring-amber-400",   ink: "text-amber-900 dark:text-amber-100",     chip: "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100" },
  reading:  { bg: "bg-amber-100 dark:bg-amber-950/40",   ring: "ring-amber-400",   ink: "text-amber-900 dark:text-amber-100",     chip: "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100" },
  writing:  { bg: "bg-rose-100 dark:bg-rose-950/40",     ring: "ring-rose-400",    ink: "text-rose-900 dark:text-rose-100",       chip: "bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100" },
  science:  { bg: "bg-emerald-100 dark:bg-emerald-950/40", ring: "ring-emerald-400", ink: "text-emerald-900 dark:text-emerald-100", chip: "bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100" },
  social:   { bg: "bg-violet-100 dark:bg-violet-950/40", ring: "ring-violet-400",  ink: "text-violet-900 dark:text-violet-100",   chip: "bg-violet-200 dark:bg-violet-800 text-violet-900 dark:text-violet-100" },
  ss:       { bg: "bg-violet-100 dark:bg-violet-950/40", ring: "ring-violet-400",  ink: "text-violet-900 dark:text-violet-100",   chip: "bg-violet-200 dark:bg-violet-800 text-violet-900 dark:text-violet-100" },
  specials: { bg: "bg-pink-100 dark:bg-pink-950/40",     ring: "ring-pink-400",    ink: "text-pink-900 dark:text-pink-100",       chip: "bg-pink-200 dark:bg-pink-800 text-pink-900 dark:text-pink-100" },
  other:    { bg: "bg-yellow-100 dark:bg-yellow-950/40", ring: "ring-yellow-400",  ink: "text-yellow-900 dark:text-yellow-100",   chip: "bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100" },
};

function colorForSubject(subject: string) {
  const key = subject.toLowerCase();
  return SUBJECT_COLOR[key] ?? SUBJECT_COLOR.other;
}

export default function Kiwi() {
  const utils = trpc.useUtils();

  // Coin total (top strip).
  const coinsQ = trpc.rewards.myCoins.useQuery();
  const coins = (coinsQ.data as any)?.balance ?? 0;

  // Practice library + today's progress.
  const lib = trpc.practice.library.useQuery();
  const progress = trpc.practice.todayProgress.useQuery();
  const complete = trpc.practice.complete.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`+${res.coinsAwarded} Kiwi Coins!`, {
          description: res.capped
            ? `You hit today's cap (${res.cap}). Save the rest for tomorrow!`
            : `Earned ${res.earnedToday}/${res.cap} coins today from extra practice.`,
        });
      } else {
        toast("No coins this time", { description: res.reason });
      }
      utils.practice.todayProgress.invalidate();
      utils.rewards?.myCoins?.invalidate?.();
      utils.rewards?.myLedger?.invalidate?.();
    },
    onError: (err) => toast.error("Couldn't save it", { description: err.message }),
  });

  // Finder-style view mode (kid-remembered).
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "icon";
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    return saved === "list" || saved === "column" || saved === "icon" ? saved : "icon";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Which subject column is currently selected (column view only).
  const groups = lib.data?.groups ?? [];
  const cap = lib.data?.dailyCap ?? 12;
  const inWindow = lib.data?.outsideSchoolHoursNow ?? true;
  const remaining = progress.data?.remaining ?? cap;
  const [openedSlug, setOpenedSlug] = useState<string | null>(null);
  const [activeColumnSubject, setActiveColumnSubject] = useState<string | null>(null);

  // Hide subjects with 0 drills (per "don't show if no info" standing rule).
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.topics.some((t) => t.drills.length > 0)),
    [groups],
  );

  // Default the column selection to the first visible subject.
  useEffect(() => {
    if (viewMode === "column" && !activeColumnSubject && visibleGroups[0]) {
      setActiveColumnSubject(visibleGroups[0].subject);
    }
  }, [viewMode, activeColumnSubject, visibleGroups]);

  const hasAnything = visibleGroups.length > 0 || coins > 0;

  const redeemUrl = useMemo(() => {
    const subject = encodeURIComponent("Reagan wants to redeem Kiwi Coins!");
    const body = encodeURIComponent(
      `Hi Mom and Grandma,\n\n` +
      `I have ${coins} Kiwi Coins right now and I'd like to use some of them.\n` +
      `Can we pick something fun together?\n\n` +
      `Love,\nReagan`,
    );
    return `mailto:marcy.spear@gmail.com?cc=spear.cpt@gmail.com&subject=${subject}&body=${body}`;
  }, [coins]);

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      {/* ── TOP STRIP ─────────────────────────────────────────────────────
          Big coin total on the left, redeem button on the right. No grey,
          no card chrome. Always visible (even when 0 coins) so the kid can
          still ask. */}
      <header className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-6xl" aria-hidden>🪙</span>
          <div>
            <div className="text-5xl font-bold leading-none text-yellow-700 dark:text-yellow-300">
              {coins}
            </div>
            <div className="text-sm font-medium text-yellow-900/80 dark:text-yellow-200/80 mt-1">
              Kiwi Coins
            </div>
          </div>
        </div>
        <a href={redeemUrl}>
          <Button
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-amber-50 shadow-md"
          >
            Email Mom &amp; Grandma to redeem
          </Button>
        </a>
      </header>

      {/* ── PRACTICE SECTION ─────────────────────────────────────────────
          Hidden entirely if the kid has nothing yet AND no coins. */}
      {hasAnything && visibleGroups.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold">Earn more coins</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pick something fun. Finish it. Earn Kiwi Coins.
                {!inWindow && (
                  <> · <span className="text-amber-700 dark:text-amber-300">opens before 9 AM, after 2 PM, and weekends</span></>
                )}
                {inWindow && remaining > 0 && (
                  <> · <span className="font-medium">{remaining} left today</span></>
                )}
              </p>
            </div>
            {/* Finder-style view toggle */}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                aria-label="Icon view"
                onClick={() => setViewMode("icon")}
                className={`px-3 py-2 text-sm flex items-center gap-1 ${
                  viewMode === "icon" ? "bg-amber-500 text-amber-50" : "hover:bg-amber-50 dark:hover:bg-amber-950/30"
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Icons
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm flex items-center gap-1 border-l border-border ${
                  viewMode === "list" ? "bg-amber-500 text-amber-50" : "hover:bg-amber-50 dark:hover:bg-amber-950/30"
                }`}
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                type="button"
                aria-label="Column view"
                onClick={() => setViewMode("column")}
                className={`px-3 py-2 text-sm flex items-center gap-1 border-l border-border ${
                  viewMode === "column" ? "bg-amber-500 text-amber-50" : "hover:bg-amber-50 dark:hover:bg-amber-950/30"
                }`}
              >
                <Columns className="w-4 h-4" /> Columns
              </button>
            </div>
          </div>

          {viewMode === "icon" && (
            <div className="space-y-6">
              {visibleGroups.map((group) => {
                const c = colorForSubject(group.subject);
                const drills = group.topics.flatMap((t) => t.drills);
                if (!drills.length) return null;
                return (
                  <div key={group.subject} className={`rounded-2xl ring-2 ${c.ring} ${c.bg} p-4`}>
                    <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${c.ink}`}>
                      <span className="text-2xl" aria-hidden>{group.emoji}</span>
                      {group.label}
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {drills.map((drill) => (
                        <DrillTile
                          key={drill.slug}
                          drill={drill}
                          color={c}
                          onOpen={() => setOpenedSlug(drill.slug)}
                          onComplete={() => complete.mutate({ slug: drill.slug })}
                          opened={openedSlug === drill.slug}
                          disabled={!inWindow || remaining <= 0 || complete.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "list" && (
            <div className="space-y-2">
              {visibleGroups.flatMap((group) => {
                const c = colorForSubject(group.subject);
                return group.topics.flatMap((topic) =>
                  topic.drills.map((drill) => (
                    <DrillRow
                      key={drill.slug}
                      drill={drill}
                      groupLabel={group.label}
                      groupEmoji={group.emoji}
                      color={c}
                      onOpen={() => setOpenedSlug(drill.slug)}
                      onComplete={() => complete.mutate({ slug: drill.slug })}
                      opened={openedSlug === drill.slug}
                      disabled={!inWindow || remaining <= 0 || complete.isPending}
                    />
                  )),
                );
              })}
            </div>
          )}

          {viewMode === "column" && (
            <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
              <div className="rounded-xl border border-border overflow-hidden">
                {visibleGroups.map((group) => {
                  const isActive = activeColumnSubject === group.subject;
                  const c = colorForSubject(group.subject);
                  return (
                    <button
                      key={group.subject}
                      type="button"
                      onClick={() => setActiveColumnSubject(group.subject)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-border last:border-b-0 ${
                        isActive ? `${c.bg} ${c.ink} font-semibold` : "hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      }`}
                    >
                      <span className="text-lg" aria-hidden>{group.emoji}</span>
                      {group.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3">
                {(() => {
                  const group = visibleGroups.find((g) => g.subject === activeColumnSubject) ?? visibleGroups[0];
                  if (!group) return null;
                  const c = colorForSubject(group.subject);
                  const drills = group.topics.flatMap((t) => t.drills);
                  return drills.map((drill) => (
                    <DrillTile
                      key={drill.slug}
                      drill={drill}
                      color={c}
                      onOpen={() => setOpenedSlug(drill.slug)}
                      onComplete={() => complete.mutate({ slug: drill.slug })}
                      opened={openedSlug === drill.slug}
                      disabled={!inWindow || remaining <= 0 || complete.isPending}
                    />
                  ));
                })()}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// --- drill cell variants ---------------------------------------------------

function DrillTile({
  drill,
  color,
  onOpen,
  onComplete,
  opened,
  disabled,
}: {
  drill: { slug: string; title: string; blurb: string; coins: number; minutes: number; provider: string; url: string };
  color: { bg: string; ring: string; ink: string; chip: string };
  onOpen: () => void;
  onComplete: () => void;
  opened: boolean;
  disabled: boolean;
}) {
  return (
    <div className={`rounded-xl ring-1 ${color.ring} bg-white p-3 flex flex-col gap-2 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold leading-snug truncate ${color.ink}`}>{drill.title}</p>
          <p className="text-xs text-stone-700 mt-0.5 line-clamp-2">{drill.blurb}</p>
        </div>
        <Badge className={`shrink-0 text-xs ${color.chip}`}>🪙 {drill.coins}</Badge>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-[11px] text-stone-600 truncate">{drill.provider} · ~{drill.minutes} min</span>
        <div className="flex gap-2 shrink-0">
          <a href={drill.url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
            <Button size="sm" variant="default">{opened ? "Reopen" : "Open"}</Button>
          </a>
          <Button size="sm" variant="outline" disabled={disabled} onClick={onComplete}>
            Done!
          </Button>
        </div>
      </div>
    </div>
  );
}

function DrillRow({
  drill,
  groupLabel,
  groupEmoji,
  color,
  onOpen,
  onComplete,
  opened,
  disabled,
}: {
  drill: { slug: string; title: string; blurb: string; coins: number; minutes: number; provider: string; url: string };
  groupLabel: string;
  groupEmoji: string;
  color: { bg: string; ring: string; ink: string; chip: string };
  onOpen: () => void;
  onComplete: () => void;
  opened: boolean;
  disabled: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border-l-4 ${color.ring} bg-white px-3 py-2 shadow-sm`}>
      <span className="text-xl shrink-0" aria-hidden>{groupEmoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] uppercase tracking-wide font-semibold ${color.ink}`}>{groupLabel}</span>
          <span className="text-xs text-stone-600">· ~{drill.minutes} min · {drill.provider}</span>
        </div>
        <p className={`font-medium leading-tight truncate ${color.ink}`}>{drill.title}</p>
      </div>
      <Badge className={`shrink-0 text-xs ${color.chip}`}>🪙 {drill.coins}</Badge>
      <div className="flex gap-2 shrink-0">
        <a href={drill.url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
          <Button size="sm" variant="default">{opened ? "Reopen" : "Open"}</Button>
        </a>
        <Button size="sm" variant="outline" disabled={disabled} onClick={onComplete}>
          Done!
        </Button>
      </div>
    </div>
  );
}
