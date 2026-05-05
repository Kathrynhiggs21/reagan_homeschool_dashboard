import { trpc } from "@/lib/trpc";
import { popConfettiFromElement } from "@/lib/confetti";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState } from "react";
import { toast } from "sonner";
import BlockEditor, { type ExistingBlock } from "@/components/BlockEditor";
import GradeBlockDialog from "@/components/GradeBlockDialog";
import AnswerKeyDialog from "@/components/AnswerKeyDialog";
import TurnInDialog from "@/components/TurnInDialog";
import { subjectTint, tintCardStyle, tintInkStyle, tintPillStyle, rainbowCardStyle, rainbowPillStyle, rainbowInkStyle, rainbowStop } from "@/lib/subjectColors";
import { celebrateKiwi } from "@/components/KiwiPerch";
import ThemePickerStrip from "@/components/ThemePickerStrip";
import KiwiIntroStrip from "@/components/KiwiIntroStrip";
import IntroTour from "@/components/IntroTour";
import ConfidencePrinciplesStrip from "@/components/ConfidencePrinciplesStrip";
import SkillBuilderTile from "@/components/SkillBuilderTile";
import PlacementInviteCard from "@/components/PlacementInviteCard";
import CurriculumChip from "@/components/CurriculumChip";
import TopicLabel from "@/components/TopicLabel";
import GameBreakCard from "@/components/GameBreakCard";
import HomeAnalyticsStrip from "@/components/HomeAnalyticsStrip";
import AIScheduleGeneratorCard from "@/components/AIScheduleGeneratorCard";
import BrainBreakTvBox from "@/components/BrainBreakTvBox";
import MascotGreeting from "@/components/MascotGreeting";
import TodaySchoolWork, { type TodaySchoolWorkHandle, type TodayPrintableItem } from "@/components/TodaySchoolWork";
import { detectSubjectSlug, findBestPrintableForSubject, findAllPrintablesForSubject } from "@/lib/matchPrintable";
import { fallbackActivityFor } from "@/lib/subjectFallbackActivity";
import { useRef } from "react";
import { dailyTipForDate, localDateKey } from "@/lib/dailyTips";
import { speakLikeBird } from "@/lib/birdVoice";
import { Volume2 } from "lucide-react";

// Neutral classroom mood language + classroom-y icons
const ZONES = [
  { z: "green",  icon: "🟢", label: "Good" },
  { z: "yellow", icon: "🟡", label: "Okay" },
  { z: "red",    icon: "🔴", label: "Rough" },
];

const STRUGGLE_INTENSITIES = [
  { value: "yellow", label: "Kinda hard" },
  { value: "red",    label: "Really hard" },
];

const COMMON_TRIGGERS = ["too long", "too hard", "boring", "noisy", "tired", "didn't get it"];
const COMMON_HELPERS  = ["a break", "a snack", "the parakeets", "outside", "drawing", "Helper helped", "Mom helped"];

// Rotate a chalk-chip color per schedule row (classroom brights)
const CHIP_COLORS = ["chip-pink", "chip-yellow", "chip-cyan", "chip-lime", "chip-coral", "chip-violet", "chip-orange"] as const;

// Chalkboard subject illustration tiles
const SUBJECT_TILES: Record<string, string> = {
  math:     "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-math-GDvMDcWdUWiyUVqvPPhH28.webp",
  reading:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-reading-NZeZTX7tk5FvyoyZXYPwNa.webp",
  ela:      "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-reading-NZeZTX7tk5FvyoyZXYPwNa.webp",
  writing:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-writing-Vw9chobvTCUGm6tzZvCg6H.webp",
  science:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-science-JMiWUYXXdUnZ3nVikeNQb5.webp",
  art:      "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-art-L94UFK6EijVaPmxjXhVxDW.webp",
  music:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-music-9L3nZsUGhgec67ggkd8bxd.webp",
  outdoors: "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-outdoors-TP2qJ3ECbys7zseUwnwazP.webp",
  pe:       "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-outdoors-TP2qJ3ECbys7zseUwnwazP.webp",
  snack:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-snack-AfiqhVvLjG9J5ZkBrhtuK8.webp",
  break:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-snack-AfiqhVvLjG9J5ZkBrhtuK8.webp",
  wonder:   "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/tile-wonder-FZ6zaUtunJLBXvcXAjejbd.webp",
};
function tileFor(slug?: string | null): string {
  if (!slug) return SUBJECT_TILES.wonder;
  const key = slug.toLowerCase();
  return SUBJECT_TILES[key] || SUBJECT_TILES.wonder;
}

function blockTimeLabel(i: number): string {
  // Give each block a clean time label (pretend a typical school schedule).
  // We intentionally keep this cosmetic — real scheduling isn't the point.
  const starts = ["8:30", "9:15", "10:00", "10:45", "11:30", "1:00", "1:45", "2:30"];
  return starts[i % starts.length];
}

export default function Today() {
  const { companionAvatar, companionName, setOpen } = useKiwi();
  // Kiwi-led intro tour — auto-shows once for new visitors. Mom-requested
  // May 2026; the "🐤 Tour" button below the hero re-opens it any time.
  const [tourOpen, setTourOpen] = useState<boolean>(() => {
    try {
      return window.localStorage?.getItem("kiwiTourSeen") !== "1";
    } catch {
      return false;
    }
  });
  const { unlocked } = useAdultLock();
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged.") });
  const moodM = trpc.mood.log.useMutation({ onSuccess: () => toast.success("Got it.") });
  const completeM = trpc.blocks.complete.useMutation();
  const moveBlockM = trpc.blocks.move.useMutation();
  // adultAi.postponeBlock = move-to-any-date; we use it for the inline
  // "→ Tomorrow" quick-action so Mom can defer a block without opening the editor.
  const postponeBlockM = (trpc as any).adultAi?.postponeBlock?.useMutation?.();
  const specialDay = trpc.specialDays.today.useQuery();
  const absentToday = trpc.prefs.getPublic.useQuery({ key: `absence:${new Date().toISOString().slice(0,10)}` });
  const isAbsentToday = absentToday.data === "1";
  const encouragement = trpc.encouragement.list.useQuery({ unreadOnly: false });
  const joke = trpc.kiwi.joke.useQuery();
  const recap = trpc.kiwi.endOfDayRecap.useQuery();
  const utils = trpc.useUtils();

  const todaySchoolWorkRef = useRef<TodaySchoolWorkHandle>(null);
  const [printableItems, setPrintableItems] = useState<TodayPrintableItem[]>([]);
  const [flashTile, setFlashTile] = useState<number | null>(null);

  // Library lookup for the schedule-block Open button. Cheap to mount
  // because list is also useful elsewhere on the page.
  const todayDate = new Date().toISOString().slice(0, 10);
  const libraryToday = trpc.library.list.useQuery({
    dateFor: todayDate,
    status: "pending",
    orderBy: "recommendedUse",
    limit: 200,
    offset: 0,
  });

  async function openPrintableForBlock(block: { id?: number; title?: string | null; blockType?: string | null; subjectSlug?: string | null }) {
    const slug = detectSubjectSlug(block);
    // 1. Today's printables (Morning Brief)
    const items = todaySchoolWorkRef.current?.getItems() ?? printableItems;
    const match = findBestPrintableForSubject(items, slug);
    if (match && todaySchoolWorkRef.current?.openById(match.id)) return;
    // 2a. Adult Library — prefer rows pinned to this exact block first
    const allLibRows = libraryToday.data ?? [];
    const blockPinned = block.id != null
      ? allLibRows.filter((r) => (r as any).blockId === block.id)
      : [];
    const subjectRows = blockPinned.length > 0
      ? blockPinned
      : allLibRows.filter((r) => !slug || r.subjectSlug === slug);
    // 2b. Highest ★ wins
    const lib = subjectRows.sort((a, b) => (b.recommendedUse ?? 0) - (a.recommendedUse ?? 0))[0];
    if (lib) {
      todaySchoolWorkRef.current?.openFallback({
        title: lib.title,
        description:
          (lib.notes || lib.topic || "") +
          (lib.fromSource ? `  \u00b7 from ${lib.fromSource}${lib.ihClassroom ? " (IH)" : ""}` : ""),
        source: lib.fromSource ?? "Library",
        sourceUrl: lib.sourceUrl ?? lib.fileLink ?? null,
        pdfKey: lib.fileLink ?? null,
        estMinutes: 15,
        coinReward: 5,
        subjectSlug: slug,
      });
      return;
    }
    // 3. Curated fallback so Reagan ALWAYS sees a real worksheet/page
    const fb = fallbackActivityFor(slug, block.title);
    todaySchoolWorkRef.current?.openFallback({
      title: fb.title,
      description: fb.description + " \u00b7 Mom will pick the exact worksheet by 7 AM.",
      source: fb.source,
      sourceUrl: fb.sourceUrl,
      pdfKey: fb.pdfUrl,
      estMinutes: fb.estMinutes,
      coinReward: fb.coinReward,
      subjectSlug: slug,
    });
  }

  const [struggleDialog, setStruggleDialog] = useState<{ open: boolean; blockId?: number; subjectSlug?: string | null }>({ open: false });
  const [intensity, setIntensity] = useState<"yellow" | "red">("yellow");
  const [description, setDescription] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const animalVideo = trpc.kiwi.funnyAnimalVideo.useQuery(undefined, { enabled: videoOpen });
  // Adult edit state
  const [blockEditor, setBlockEditor] = useState<{ open: boolean; block?: ExistingBlock }>({ open: false });
  const [gradeDialog, setGradeDialog] = useState<{ open: boolean; block?: { id: number; title?: string; subjectSlug?: string | null } }>({ open: false });
  const [keyDialog, setKeyDialog] = useState<{ open: boolean; blockId?: number; title?: string }>({ open: false });
  const [turnIn, setTurnIn] = useState<{ open: boolean; block?: { id: number; title?: string; subjectSlug?: string | null }; initialMode?: "reading" | "draw" | "photo" | "typed" }>({ open: false });
  const [goodWorkDialog, setGoodWorkDialog] = useState<{ open: boolean; blockId?: number; title?: string }>({ open: false });
  const [goodWorkText, setGoodWorkText] = useState("");
  const saveGoodWorkM = trpc.prefs.set.useMutation();

  const today_str = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  // Hide test/quiz/screener/placement-style blocks from Reagan's Today list per parent request.
  // We use a permissive title-pattern filter so it works whatever blockType was assigned upstream.
  // Adults can still see/manage these from the Schedule page (we only filter Reagan's primary view).
  const TEST_PATTERNS = /\b(test|quiz|screener|screening|placement|assessment|benchmark)\b/i;
  const allBlocks = today.data?.blocks ?? [];
  const blocks = unlocked
    ? allBlocks
    : allBlocks.filter((b: any) => !TEST_PATTERNS.test(`${b.title ?? ""} ${b.description ?? ""}`));
  const hiddenTestCount = allBlocks.length - blocks.length;
  const planId = today.data?.plan?.id;
  const done = blocks.filter((b: any) => b.status === "complete").length;
  const total = blocks.length;

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  function submitStruggle() {
    if (!struggleDialog.blockId) return;
    struggleM.mutate({
      blockId: struggleDialog.blockId,
      subjectSlug: struggleDialog.subjectSlug ?? undefined,
      description: description || undefined,
      intensity,
      triggers: triggers.length ? triggers : undefined,
      copingUsed: helpers.length ? helpers : undefined,
    });
    setStruggleDialog({ open: false });
    setDescription(""); setTriggers([]); setHelpers([]); setIntensity("yellow");
  }

  return (
    <div className="space-y-4">
      {/* Theme picker strip — 4 themes Reagan can pick from */}
      <ThemePickerStrip />
      {/* Header — chalkboard slate hero. Chalk-style text on green slate, framed in oak. */}
      <header
        className="greeting-hero relative rounded-2xl p-5 md:p-7 overflow-hidden"
        style={{
          // True blackboard: charcoal/black slate with chalk-dust haze
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08), transparent 55%)," +
            "radial-gradient(ellipse at 80% 90%, rgba(255,255,255,0.05), transparent 60%)," +
            "linear-gradient(160deg, #181818 0%, #232323 45%, #121212 100%)",
          border: "6px solid #6b4a2b",
          boxShadow:
            "0 10px 30px -14px rgba(0,0,0,0.55)," +
            "inset 0 0 0 2px #4a3320," +
            "inset 0 0 80px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-end gap-4">
            <MascotGreeting />
            <div>
              <div
                className="font-chalk-hand text-2xl md:text-3xl leading-none"
                style={{
                  color: "#f5e7c7",
                  textShadow: "0 0 6px rgba(255,255,255,0.18)",
                  opacity: 0.9,
                }}
              >
                {today_str}
              </div>
              <h1
                className="font-display mt-2 leading-none flex items-baseline gap-x-3 whitespace-nowrap"
                style={{
                  // Auto-shrinks the greeting so it always fits on a single line
                  // even on narrow viewports. Uses clamp on the viewport width.
                  fontSize: "clamp(1.5rem, 5.2vw, 4.5rem)",
                  letterSpacing: "-0.01em",
                }}
              >
                {(() => {
                  const first = (profile.data?.studentName || "Reagan").split(" ")[0];
                  const words = [
                    { t: "Good",      c: "#fff4d6" }, // chalk cream
                    { t: "Morning,",  c: "#ffe9a8" }, // soft chalk yellow
                    { t: first + "!", c: "#bdf0d6" }, // chalk mint
                  ];
                  return words.map((w, i) => (
                    <span
                      key={i}
                      className="inline-block"
                      style={{
                        color: w.c,
                        textShadow:
                          "0 0 1px rgba(255,255,255,0.55), 0 0 12px rgba(255,255,255,0.18)",
                        // Subtle chalk-edge feel
                        WebkitTextStroke: "0.4px rgba(255,255,255,0.25)",
                      }}
                    >
                      {w.t}
                    </span>
                  ));
                })()}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-display text-base px-5 py-6 shadow-[0_6px_0_rgba(0,0,0,0.35),0_0_18px_rgba(255,216,106,0.25)]"
            >
              Ask {companionName}
            </Button>
            {/* Print today — opens the adult-gated DailyPacket page (full schedule + every
                worksheet for the day) and any modern browser will let Mom hit Cmd/Ctrl+P
                from there. We keep this lightweight so the homepage stays uncluttered. */}
            <Button
              onClick={() => { window.location.href = "/packet"; }}
              size="lg"
              variant="outline"
              className="rounded-full bg-card font-display text-base px-5 py-6"
              title="Open the printable Daily Packet (schedule + worksheets)"
            >
              🖨️ Print today
            </Button>
            {/* Practice for Coins — extra credit hub. Reagan can do short Khan/IXL/BrainPOP
                drills outside school hours and earn capped Kiwi Coins. */}
            <Button
              onClick={() => { window.location.href = "/practice"; }}
              size="lg"
              variant="outline"
              className="rounded-full bg-card font-display text-base px-5 py-6"
              title="Earn extra Kiwi Coins by doing fun practice drills outside school hours"
            >
              🪙 Practice for Coins
            </Button>
            {/* Replay tour — Mom-requested May 2026. Auto-shows once for new
                visitors via IntroTour's localStorage gate; this button is the
                always-available re-open. */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                try { window.localStorage?.removeItem("kiwiTourSeen"); } catch {}
                setTourOpen(true);
              }}
              className="bg-white/80 hover:bg-white"
              title="Watch Kiwi's intro tour again"
            >
              🐤 Tour
            </Button>
          </div>
        </div>
      </header>
      {/* Tutor of the day strip — "With Reagan today: <Name> · <arrival>–<departure>".
          Mom-only days quietly say "Mom-only day today" so Reagan still gets a clear cue. */}
      <TutorOfDayStrip />

      {/* Daily tip strip + Fresh-start button — deterministic by date so the tip stays stable all day */}
      <DailyTipAndFreshStart />

      {/* Kid-readable Confidence Principles — feel safe / understand / grow / you ARE smart */}
      <ConfidencePrinciplesStrip />

      {/* Component lives below the JSX */}
      {isAbsentToday && (
        <Card className="p-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏠</span>
            <div className="flex-1">
              <div className="font-extrabold text-base text-rose-900">Today's an absent day</div>
              <p className="text-sm text-rose-800 mt-1">No coins for school work today — rest, doctor visits, or family time. Tomorrow's a fresh start!</p>
            </div>
          </div>
        </Card>
      )}

      {specialDay.data && (
        <Card className="classroom-card p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{(specialDay.data as any).emoji || "📌"}</span>
            <div className="flex-1">
              <div className="font-display font-semibold text-base">Today: {(specialDay.data as any).name}</div>
              <p className="text-sm text-muted-foreground mt-1">{(specialDay.data as any).description}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Adult quick-links — Curriculum + Analytics */}
      {unlocked && (
        <Card className="classroom-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="font-display text-sm font-semibold chalk-white">Adult tools</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="bg-transparent" onClick={() => (window.location.href = "/curriculum")}>
                📚 Curriculum & Standards
              </Button>
              <Button size="sm" variant="outline" className="bg-transparent" onClick={() => (window.location.href = "/analytics")}>
                📊 Analytics
              </Button>
              <Button size="sm" variant="outline" className="bg-transparent" onClick={() => (window.location.href = "/agendas")}>
                📝 Daily Agendas
              </Button>
            </div>
          </div>
          <HomeAnalyticsStrip />
        </Card>
      )}

      {/* AI Schedule Generator — adult-gated */}
      {unlocked && (
        <AIScheduleGeneratorCard defaultDate={new Date().toISOString().slice(0, 10)} />
      )}

      {/* Check-in strip — adult-only, since mood tracking is parent-facing, not kid-facing. */}
      {unlocked && (
        <Card className="classroom-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="font-display text-sm font-semibold chalk-white">
              Adult check-in
              <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">for Mom/tutor</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {ZONES.map(z => (
                <button
                  key={z.z}
                  onClick={() => planId && moodM.mutate({ planId, zone: z.z as any })}
                  className="mood-chip"
                >
                  <span>{z.icon}</span>
                  <span>{z.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* End-of-day recap (kept, but much calmer) */}
      {total > 0 && done === total && (
        <Card className="classroom-card p-5">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🎓</span>
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Whole schedule — complete.</div>
              <p className="text-sm text-muted-foreground mt-1">
                {done} of {total} blocks done today.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent mt-3"
                onClick={() => recap.refetch()}
              >
                {companionAvatar} Read {companionName}'s note
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Kiwi intro — dismissible, plain-language */}
      <KiwiIntroStrip />

      {/* Diagnostic Placement invite — gentle, optional, dismisses at 100% */}
      <PlacementInviteCard />

      {/* Today's Schedule sits near the top so it's always visible quickly */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl font-semibold chalk-white">Today's Schedule</h2>
          <div className="flex items-center gap-2">
            {hiddenTestCount > 0 && unlocked === false && (
              <span
                className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-200/40 text-amber-100 border border-amber-300/40"
                title={`${hiddenTestCount} item(s) hidden from Reagan because they're tests/quizzes/screeners. Unlock adult area to view.`}
              >
                {hiddenTestCount} hidden
              </span>
            )}
            {total > 0 && (
              <span className="text-xs text-muted-foreground">{done} / {total} done</span>
            )}
          </div>
        </div>
        {today.isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
        {!today.isLoading && blocks.length === 0 && (
          <Card className="classroom-card p-6 text-center">
            <p className="font-display text-base mb-1">No blocks for today.</p>
            <p className="text-sm text-muted-foreground">Adults can build today's plan from the Tutor Handoff page.</p>
          </Card>
        )}
        {unlocked && planId && (
          <div className="flex justify-end mb-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-transparent h-7 text-xs"
              onClick={() => setBlockEditor({ open: true, block: undefined })}
            >
              + Add block
            </Button>
          </div>
        )}
        <div className="space-y-2">
          {blocks.map((b: any, i: number) => {
            const isDone = b.status === "complete";
            const tint = subjectTint(b.subjectSlug);
            const stop = rainbowStop(i);
            return (
              <div
                key={b.id}
                className={`schedule-row-v2 ${isDone ? "is-done" : ""}`}
                style={rainbowCardStyle(i)}
              >
                {/* 3D subject icon tile (bigger, glowing) */}
                <div className="subject-icon-tile" style={{ boxShadow: `0 4px 0 rgba(0,0,0,0.35), 0 0 18px ${stop.border}44, inset 0 2px 0 rgba(255,255,255,0.05)` }}>
                  <img src={tileFor(b.subjectSlug)} alt="" />
                </div>
                {/* Time + body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="time-chip time-chip-v2" style={rainbowPillStyle(i)}>{blockTimeLabel(i)}</span>
                    <span className="text-xl" aria-hidden="true">{tint.emoji}</span>
                    <div className="font-display font-bold leading-tight" style={{ ...rainbowInkStyle(i), fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)" }}>{b.title}</div>
                    <CurriculumChip match={`${b.title || ""} ${b.description || ""}`} />
                  </div>
                  <div className="mt-1">
                    <TopicLabel subjectSlug={b.subjectSlug} topicName={b.curriculumTopicName ?? null} size="xs" />
                  </div>
                  {/* Page references — Mom asked May 2026 to surface
                      "📖 Tuck Everlasting · pg 24–28" on every block. The
                      backend now joins bookAssignments into listBlocksForPlan,
                      so b.pageRefs is an array of { bookTitle, fromPage, toPage, notes }. */}
                  {Array.isArray(b.pageRefs) && b.pageRefs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5" aria-label="Reading pages for this block">
                      {b.pageRefs.map((pr: any, idx: number) => (
                        <span
                          key={`${pr.bookId}-${idx}`}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-300/15 border border-amber-300/35 px-2 py-0.5 text-[11px] font-semibold text-amber-50"
                          title={pr.notes || undefined}
                        >
                          <span aria-hidden="true">📖</span>
                          <span className="truncate max-w-[220px]">
                            {pr.bookTitle || "Reading"}
                          </span>
                          <span className="opacity-90">· pg {pr.fromPage}{pr.toPage && pr.toPage !== pr.fromPage ? `–${pr.toPage}` : ""}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const slug2 = detectSubjectSlug(b);
                    const matches = findAllPrintablesForSubject(printableItems, slug2, 3);
                    if (matches.length === 0) return null;
                    return (
                      <div className="mt-1.5 flex gap-1.5 flex-wrap" aria-label="Files attached to this block">
                        {matches.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => todaySchoolWorkRef.current?.openById(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 border border-white/25 hover:bg-white/20 text-[11px] chalk-white max-w-[260px] truncate"
                            title={m.title}
                          >
                            <span aria-hidden="true">{m.pdfKey ? "📄" : m.thumbKey ? "🖼️" : "✏️"}</span>
                            <span className="truncate">{m.title}</span>
                            {m.status === "done" && <span className="ml-1 text-emerald-300">✓</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {b.description && (
                    <p className="mt-1 chalk-white/90" style={{ fontSize: "0.95rem", opacity: 0.82, lineHeight: 1.35 }}>{b.description}</p>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(() => {
                      const slug = detectSubjectSlug(b);
                      const match = findBestPrintableForSubject(printableItems, slug);
                      return (
                        <>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs font-bold bg-amber-300 text-amber-950 hover:bg-amber-200"
                            onClick={() => openPrintableForBlock(b)}
                          >
                            📄 Open{match ? "" : " …"}
                          </Button>
                          {match && (
                            <span className="h-8 inline-flex items-center px-2 rounded-md bg-emerald-400/20 border border-emerald-300/40 text-emerald-50 text-[10px] font-semibold">
                              printable ready
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/10 border-white/25 chalk-white hover:bg-white/20 h-8 px-3 text-xs"
                      onClick={() => setTurnIn({ open: true, block: { id: b.id, title: b.title, subjectSlug: b.subjectSlug }, initialMode: "draw" })}
                      title="Draw your answers right on the worksheet with the Apple Pencil"
                    >
                      ✏️ Draw on it
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/10 border-white/25 chalk-white hover:bg-white/20 h-8 px-3 text-xs"
                      onClick={() => setTurnIn({ open: true, block: { id: b.id, title: b.title, subjectSlug: b.subjectSlug } })}
                    >
                      📝 Turn in
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs chalk-white hover:bg-white/10"
                      onClick={() => setOpen(true)}
                    >
                      Help
                    </Button>
                    {unlocked && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => setBlockEditor({ open: true, block: b as any })}
                          title="Adult: edit this block"
                        >
                          ✎ Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => setGradeDialog({ open: true, block: { id: b.id, title: b.title, subjectSlug: b.subjectSlug } })}
                          title="Adult: grade this block"
                        >
                          🅰 Grade
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => setKeyDialog({ open: true, blockId: b.id, title: b.title })}
                          title="Adult: set answer key for auto-grading"
                        >
                          🔑 Key
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-white/60 hover:bg-white/10"
                          onClick={() => setStruggleDialog({ open: true, blockId: b.id, subjectSlug: b.subjectSlug })}
                          title="Adult-only: log a moment Reagan found hard"
                        >
                          Note a struggle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => setGoodWorkDialog({ open: true, blockId: b.id, title: b.title })}
                          title="Adult: attach a Good Work note"
                        >
                          ★ Good Work
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => moveBlockM.mutate(
                            { id: b.id, direction: "up" },
                            { onSuccess: () => { utils.plans.today.invalidate(); } },
                          )}
                          disabled={i === 0 || moveBlockM.isPending}
                          title="Move this block up in the day"
                        >
                          ↑ Earlier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                          onClick={() => moveBlockM.mutate(
                            { id: b.id, direction: "down" },
                            { onSuccess: () => { utils.plans.today.invalidate(); } },
                          )}
                          disabled={i === blocks.length - 1 || moveBlockM.isPending}
                          title="Move this block down in the day"
                        >
                          ↓ Later
                        </Button>
                        {postponeBlockM && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
                            onClick={() => {
                              const t = new Date();
                              const tom = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
                              const yyyy = tom.getFullYear();
                              const mm = String(tom.getMonth() + 1).padStart(2, "0");
                              const dd = String(tom.getDate()).padStart(2, "0");
                              postponeBlockM.mutate(
                                { blockId: b.id, toDate: `${yyyy}-${mm}-${dd}` },
                                {
                                  onSuccess: () => {
                                    toast.success(`Moved to ${mm}/${dd}.`);
                                    utils.plans.today.invalidate();
                                    utils.plans.byDate.invalidate();
                                  },
                                  onError: (e: any) => toast.error(e?.message || "Move failed."),
                                },
                              );
                            }}
                            disabled={postponeBlockM.isPending}
                            title="Re-parent this block to tomorrow's plan"
                          >
                            → Tomorrow
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* BIG obvious end-of-row checkmark */}
                <button
                  type="button"
                  aria-label={isDone ? "Completed" : "Mark complete"}
                  className={`schedule-check ${isDone ? "is-checked" : ""}`}
                  style={{ ['--check-accent' as any]: stop.border }}
                  onClick={(ev) => {
                    if (isDone) return;
                    const tgt = ev.currentTarget as HTMLElement;
                    popConfettiFromElement(tgt);
                    completeM.mutate({ id: b.id }, { onSuccess: () => { toast.success("Done!"); celebrateKiwi("Yay! 🎉 +1 sticker!"); utils.plans.today.invalidate(); }});
                  }}
                >
                  {isDone ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="5 12 10 17 19 8" />
                    </svg>
                  ) : (
                    <span className="sr-only">Mark complete</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's School Work — three-bucket printables from morning brief */}
      <TodaySchoolWork ref={todaySchoolWorkRef} onItemsChanged={setPrintableItems} />

      {/* Daily 15-min Skill Builder — next-up skill from her ladder */}
      <SkillBuilderTile />

      {/* Game-as-reward / mood break (only renders on signal) */}
      <GameBreakCard />

      {/* Brain-Break TV Box — rotating kid-safe short clips */}
      <BrainBreakTvBox />

      {/* Tour Mode — calm pinned strip, no ombre gradient */}
      <TourModeCard />

      {/* ===== Widget grid (everything-after-the-schedule) ===== */}
      <section className="pt-2">
        <h2 className="font-display font-semibold mb-3" style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)", color: "rgba(255,255,255,0.85)" }}>
          A little extra ✨
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="widget-tile">
            <div className="rounded-2xl p-4 h-full" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,216,106,0.25)",
              boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
            }}>
              <div className="font-display font-semibold text-lg mb-2" style={{ color: "#ffd97a" }}>A little joke 🧠</div>
              <div className="text-[15px] leading-snug chalk-white">{joke.data?.text || "Pulling a joke..."}</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="bg-transparent h-8 px-3 text-xs" onClick={() => joke.refetch()}>Another</Button>
              </div>
            </div>
          </div>
          <div className="widget-tile">
            <div className="rounded-2xl p-4 h-full" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(127,227,196,0.25)",
              boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
            }}>
              <div className="font-display font-semibold text-lg mb-2" style={{ color: "#7fe3c4" }}>{companionName}'s note 📝</div>
              <div className="text-[15px] leading-snug whitespace-pre-line chalk-white/90">
                {recap.data?.recap || "A short note will appear here at the end of the day."}
              </div>
            </div>
          </div>
          {encouragement.data && encouragement.data.length > 0 && (
            <div className="widget-tile md:col-span-2">
              <div className="rounded-2xl p-4 h-full" style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,159,178,0.25)",
                boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
              }}>
                <div className="font-display font-semibold text-lg mb-3" style={{ color: "#ff9fb2", textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}>Notes for you 💕</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {encouragement.data.slice(0, 3).map((n: any) => (
                    <div key={n.id} className="rounded-xl p-3" style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "0 3px 0 rgba(0,0,0,0.25)",
                    }}>
                      <div className="text-[15px] chalk-white">“{n.content}”</div>
                      <div className="text-xs mt-1" style={{ color: "#ffd97a" }}>— {n.fromName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Struggle dialog — toned down */}
      <Dialog open={struggleDialog.open} onOpenChange={(o) => setStruggleDialog(s => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">What was hard?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">How hard?</div>
              <div className="grid grid-cols-2 gap-2">
                {STRUGGLE_INTENSITIES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setIntensity(s.value as any)}
                    className={`border rounded-md p-3 text-center transition ${
                      intensity === s.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-white/5"
                    }`}
                  >
                    <span className="text-sm font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">What was tough? (tap any)</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TRIGGERS.map(t => (
                  <button
                    key={t}
                    onClick={() => toggle(triggers, setTriggers, t)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      triggers.includes(t)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white/5 border-border"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">What helped?</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_HELPERS.map(h => (
                  <button
                    key={h}
                    onClick={() => toggle(helpers, setHelpers, h)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      helpers.includes(h)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white/5 border-border"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Anything else? (optional)</div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-white/5 p-2 text-sm"
                placeholder="A few words if you want..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStruggleDialog({ open: false })}>Not now</Button>
            <Button onClick={submitStruggle}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adult block editor */}
      <BlockEditor
        open={blockEditor.open}
        onOpenChange={(v) => setBlockEditor((s) => ({ ...s, open: v }))}
        planId={planId}
        block={blockEditor.block}
      />

      {/* Grade dialog */}
      <GradeBlockDialog
        open={gradeDialog.open}
        onOpenChange={(v) => setGradeDialog((s) => ({ ...s, open: v }))}
      />
      <AnswerKeyDialog
        open={keyDialog.open}
        onOpenChange={(v) => setKeyDialog((s) => ({ ...s, open: v }))}
        blockId={keyDialog.blockId ?? null}
        blockTitle={keyDialog.title}
      />
      <TurnInDialog
        open={turnIn.open}
        block={turnIn.block}
        initialMode={turnIn.initialMode}
        onOpenChange={(v) => setTurnIn((s) => ({ ...s, open: v }))}
      />

      {/* Animal video */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Animal break</DialogTitle></DialogHeader>
          {animalVideo.data ? (
            <div>
              <div className="aspect-video rounded-md overflow-hidden bg-muted">
                <iframe src={animalVideo.data.embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
              </div>
              <div className="text-sm text-muted-foreground mt-2 text-center">{animalVideo.data.title}</div>
            </div>
          ) : <div className="py-8 text-center text-sm text-muted-foreground">finding something good...</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => animalVideo.refetch()}>Another</Button>
            <Button onClick={() => setVideoOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ============ Good Work note dialog (adult) ============ */}
      <Dialog open={goodWorkDialog.open} onOpenChange={(o) => { setGoodWorkDialog({ open: o }); if (!o) setGoodWorkText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>★ Good Work note — {goodWorkDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-muted-foreground">A short message that will stamp onto this work in her Notebook/Portfolio.</div>
            <textarea
              value={goodWorkText}
              onChange={(e) => setGoodWorkText(e.target.value)}
              rows={4}
              maxLength={280}
              placeholder="You showed up even when it felt hard. That's the whole game. ★"
              className="w-full rounded-md border p-2 text-sm bg-white text-neutral-900"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoodWorkDialog({ open: false })}>Cancel</Button>
            <Button
              disabled={!goodWorkText.trim() || saveGoodWorkM.isPending}
              onClick={() => {
                if (!goodWorkDialog.blockId) return;
                saveGoodWorkM.mutate(
                  { key: `block:${goodWorkDialog.blockId}:goodWork`, value: goodWorkText.trim() },
                  {
                    onSuccess: () => {
                      toast.success("Good Work note saved ★");
                      setGoodWorkDialog({ open: false });
                      setGoodWorkText("");
                    },
                  },
                );
              }}
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Kiwi-led intro tour overlay (auto-shows once; "🐤 Tour" replays it). */}
      <IntroTour
        open={tourOpen}
        onClose={() => {
          // Defensive: ensure the seen flag is set on EVERY close path so the
          // tour never auto-re-shows next visit, even if the user dismisses
          // by some path that didn't already call markTourSeen().
          try { window.localStorage?.setItem("kiwiTourSeen", "1"); } catch {}
          setTourOpen(false);
        }}
      />
    </div>
  );
}


/* ============ Tour Mode card (Apr 28 is Reagan's soft-open day) ============ */
function TourModeCard() {
  const today = new Date();
  const m = today.getMonth(); // 0-indexed (3 = April)
  const d = today.getDate();
  // Show for Apr 28, 29, 30 (the opening week)
  let msg: { tag: string; emoji: string; title: string; body: string; chip?: string } | null = null;
  if (m === 3 && d === 28) {
    msg = {
      tag: "Day 1 — Tour",
      emoji: "🏠",
      title: "Explore your new classroom!",
      body: "Today's a light day. Peek at your schedule, poke around, and meet Kiwi. No pressure — check off whatever feels fun.",
      chip: "11am · Tutor trial 🧑‍🏫",
    };
  } else if (m === 3 && d === 29) {
    msg = {
      tag: "Day 2 — Placement",
      emoji: "🧭",
      title: "Placement day with your tutor!",
      body: "Today your tutor will try a few quick tasks so we can build the perfect plan just for you.",
    };
  } else if (m === 3 && d === 30) {
    msg = {
      tag: "Day 3 — Official start!",
      emoji: "🎉",
      title: "Your first real school day!",
      body: "Welcome to homeschool! Your daily playlist is ready. Do the list in any order — just finish it!",
    };
  }
  if (!msg) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,216,106,0.25)",
      }}
    >
      <div className="text-2xl">{msg.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold" style={{ color: "#ffd97a", fontSize: "1.05rem" }}>{msg.title}</div>
        <div className="text-sm chalk-white/75 leading-snug">{msg.body}</div>
      </div>
      {msg.chip && (
        <div className="hidden sm:block text-xs font-semibold px-2 py-1 rounded-full" style={{
          background: "rgba(255,216,106,0.18)",
          color: "#ffd97a",
          border: "1px solid rgba(255,216,106,0.35)",
        }}>
          {msg.chip}
        </div>
      )}
    </div>
  );
}

/* ============ Coin + Sticker strip (live from rewards API) ============ */
function CoinStickerStrip() {
  const coins = trpc.rewards.myCoins.useQuery();
  const stks = trpc.rewards.myStickers.useQuery();
  const coinCount = coins.data?.balance ?? 0;
  const stickerCount = Array.isArray(stks.data) ? stks.data.length : 0;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a
        href="/stickers"
        className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm hover:shadow transition"
        style={{ backgroundColor: "#ffe066", color: "#4a3600", border: "2px solid #d4a900" }}
      >
        <span className="text-lg">⭐</span>
        <span>{stickerCount}</span>
        <span className="opacity-70 font-normal text-xs">stickers</span>
      </a>
      <a
        href="/prizes"
        className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm hover:shadow transition"
        style={{ backgroundColor: "#7fe3c4", color: "#063c2d", border: "2px solid #10b981" }}
      >
        <span className="text-lg">🪙</span>
        <span>{coinCount}</span>
        <span className="opacity-70 font-normal text-xs">coins · prize shop</span>
      </a>
    </div>
  );
}


/* ============ Daily tip + Fresh-start button (top of Today) ============ */
function DailyTipAndFreshStart() {
  const tip = dailyTipForDate(localDateKey());
  const utils = trpc.useUtils();
  const refresh = trpc.today.refresh.useMutation({
    onSuccess: () => {
      try { (utils as any).schedule?.invalidate?.(); } catch { /* ok */ }
      try { (utils as any).today?.coverage?.invalidate?.(); } catch { /* ok */ }
      try { utils.invalidate(); } catch { /* ok */ }
    },
  });
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] leading-snug flex-1"
        style={{
          background: "rgba(255,238,170,0.10)",
          borderColor: "rgba(255,238,170,0.35)",
          color: "#fff4d6",
        }}
      >
        <span aria-hidden className="text-base">💡</span>
        <span className="flex-1">{tip}</span>
        <button
          onClick={() => speakLikeBird(tip)}
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] hover:bg-white/10"
          aria-label="Read today's tip out loud"
          title="Read this to me"
        >
          <Volume2 className="w-3 h-3" /> Read
        </button>
      </div>
      <button
        type="button"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate({})}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold border hover:bg-white/10 disabled:opacity-60"
        style={{
          background: "rgba(127,227,196,0.12)",
          borderColor: "rgba(127,227,196,0.45)",
          color: "#bff5e0",
        }}
        title="Rebuild today's plan — keeps your finished and started work"
      >
        <span aria-hidden>🔄</span>
        {refresh.isPending ? "Refreshing…" : "Fresh start"}
      </button>
    </div>
  );
}


/**
 * TutorOfDayStrip
 * ----------------
 * Small chalkboard-style chip just under the hero that tells Reagan (and any
 * adult glancing at her screen) who she's working with today and when they'll
 * be here. Pulls from `tutors.tutorOfDay` (public, server-resolved).
 *
 * Three states:
 *   - tutor scheduled  → "👋 With Reagan today: Ms. Sara · 9:00 AM–11:30 AM"
 *   - Mom-only day     → "🏠 Mom-only day today"
 *   - loading / error  → renders nothing (no skeleton noise on the hero)
 */
function TutorOfDayStrip() {
  const today = new Date().toISOString().slice(0, 10);
  // typed loosely so we don't break if the procedure isn't deployed yet
  const q = (trpc as any).tutors?.tutorOfDay?.useQuery?.({ dateStr: today }) ?? {
    data: null,
    isLoading: false,
    isError: false,
  };
  if (q.isLoading || q.isError) return null;
  const t = (q.data as any) || null;

  if (!t) {
    return (
      <Card className="classroom-card p-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>🏠</span>
        <div className="text-sm">
          <span className="font-display font-semibold">Mom-only day today.</span>{" "}
          <span className="text-muted-foreground">No tutor scheduled.</span>
        </div>
      </Card>
    );
  }

  const window =
    t.arrival && t.departure ? `${t.arrival}–${t.departure}` : t.arrival || t.departure || "";

  return (
    <Card className="classroom-card p-3 flex items-center gap-3">
      <span className="text-xl" aria-hidden>👋</span>
      <div className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground">With Reagan today:</span>
        <span className="font-display font-semibold">{t.name}</span>
        {t.role ? <span className="text-muted-foreground">· {t.role}</span> : null}
        {window ? <span className="text-muted-foreground">· {window}</span> : null}
      </div>
    </Card>
  );
}
