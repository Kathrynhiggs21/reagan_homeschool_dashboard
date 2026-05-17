import { trpc } from "@/lib/trpc";
import { MakeRequestButton } from "@/components/MakeRequestButton";
import { popConfettiFromElement } from "@/lib/confetti";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useKiwi } from "@/contexts/KiwiContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState, useEffect } from "react";
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
// Push 59 (2026-05-13) — Kid-friendly micro strips at top of Today.
import KidHeaderStrips from "@/components/KidHeaderStrips";
import MoodTimelineStrip from "@/components/MoodTimelineStrip";
import { SlayChargeCard } from "@/components/SlayChargeCard";
import SummerModeBadge from "@/components/SummerModeBadge";
import CatchUpNextDayCard from "@/components/CatchUpNextDayCard";
import { TomorrowChoiceCard } from "@/components/TomorrowChoiceCard";
import TodayClassroomCard from "@/components/TodayClassroomCard";
import TodayClassroomGradedCard from "@/components/TodayClassroomGradedCard";
import TodayMomVoiceMemoCard from "@/components/TodayMomVoiceMemoCard";
import TodayCoveredRecapCard from "@/components/TodayCoveredRecapCard";
import TodayForwardPlanCard from "@/components/TodayForwardPlanCard";
import TodayAdultQuickEntryCard from "@/components/TodayAdultQuickEntryCard";
// Push 84 (2026-05-13) — Adult Today recap: off-plan capture summary.
import { OffPlanCaptureCard } from "@/components/OffPlanCaptureCard";
import { TapEditPopover } from "@/components/TapEditPopover";
import GeneratedBlockHint from "@/components/GeneratedBlockHint";
// Push 50 (2026-05-13) — Post-block feedback chips for Reagan.
import FeedbackChips from "@/components/FeedbackChips";
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
  // Initial state respects localStorage; server profile flag is then checked
  // below in a useEffect so the tour also stays dismissed cross-device.
  const [tourOpen, setTourOpen] = useState<boolean>(() => {
    try {
      return window.localStorage?.getItem("kiwiTourSeen") !== "1";
    } catch {
      return false;
    }
  });
  const { unlocked } = useAdultLock();
  const profile = trpc.profile.get.useQuery();
  // Push 2.13 (2026-05-17): when the server profile says onboarding is done,
  // close any auto-mounted tour and pin localStorage so it stays closed.
  useEffect(() => {
    const done = (profile.data as any)?.onboardingCompleted;
    if (done) {
      try {
        window.localStorage?.setItem("kiwiTourSeen", "1");
      } catch {
        /* no-op */
      }
      setTourOpen(false);
    }
  }, [profile.data]);
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged.") });
  const moodM = trpc.mood.log.useMutation({ onSuccess: () => toast.success("Got it.") });
  const completeM = trpc.blocks.complete.useMutation();
  /**
   * Push 50 (2026-05-13) — When Reagan self-completes a block, surface the
   * FeedbackChips card in an inline dialog so she can tap easy/ok/hard,
   * what helped, time felt, and "want a break" without leaving Today.
   * Adults grading via the family-admin proc DON'T see chips (already in
   * the GradeBlockDialog flow).
   */
  const [feedbackForBlockId, setFeedbackForBlockId] = useState<number | null>(null);
  // Push 43 (2026-05-13) — Reagan self-completes her own block.
  // Used when the adult area is locked; adult-unlocked sessions still use
  // blocks.complete so the audit log captures the grading adult.
  const selfCompleteM = (trpc as any).blocks?.selfComplete?.useMutation?.();
  const moveBlockM = trpc.blocks.move.useMutation();
  // Push 55 (2026-05-13) — Reagan-side reorder mutation. Optional access
  // via `as any` so the build doesn't bind to it strictly; we still get
  // type completion at the call site through optional chaining.
  const selfReorderM = (trpc as any).blocks?.selfReorder?.useMutation?.();
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
            {/* Make a request — push 26. Reagan can fire a kid-friendly note to
                Mom + Dad + Grandma from any kid page. See MakeRequestButton.tsx. */}
            <MakeRequestButton />
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
              <Button size="sm" variant="outline" className="bg-transparent" onClick={() => (window.location.href = "/agenda-editor")}>
                📝 Agenda Editor
              </Button>
            </div>
          </div>
          <HomeAnalyticsStrip />
        </Card>
      )}

      {/* Push 39 (2026-05-13) — Adult quick-entry card.
          One-tap log of what Reagan actually did today (subject + topic +
          minutes + optional notes). Writes through trpc.actuals.quickAdd
          (familyAdmin gate). Hidden when adult is not unlocked so the
          kid view stays calm. */}
      {unlocked && (
        <TodayQuickEntryCard />
      )}

      {/* Push 41 (2026-05-13) — Mood timeline strip.
          Adult-only visualisation derived from the same ambient-listening
          chunks that power the Kiwi behavior helper. 12 bins across the
          school day, color-coded green/yellow/red. Empty days render
          nothing so the page stays calm. */}
      {unlocked && <TodayMoodTimelineStrip />}

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

      {/* Push 65 (2026-05-13) — Summer-mode badge: self-hides outside the
          Jun 6 → Aug 15 window (or when Mom flips override off / declares
          a vacation range). Reads existing public summer.* prefs. */}
      <div className="mb-2"><SummerModeBadge /></div>

      {/* Push 59 (2026-05-13) — Kid-readable today strips:
          progress %, last 3 days of mood dots, resume-where-left-off card.
          Always visible to Reagan; adults still see the analytics card lower. */}
      <KidHeaderStrips />

      {/* Push 90 (2026-05-13) — Hour-by-hour mood timeline strip.
          Kid-facing zone-colored bars across today's school-day window.
          Self-hides when no mood entries have been logged for today. */}
      <MoodTimelineStrip />

      {/* Push 73 (2026-05-13) — "From yesterday" catch-up nudges; self-hides
          when nothing was missed and never blocks the schedule. */}
      <CatchUpNextDayCard />

      {/* Push 84 (2026-05-13) — Adult Today recap: off-plan capture summary.
          Self-hides when totalCount === 0 OR when caller is Reagan (the
          server returns allowed:false). Adults see today's captured topics
          + Drive push status; kid never sees this. */}
      <OffPlanCaptureCard />

      {/* Push 82 (2026-05-13) — Tomorrow's summer-choice 3-option chooser.
          Only renders when summer mode is active for tomorrow's date.
          Reagan picks among pre-approved options; the pick auto-approves
          (no SMS to Mom/Grandma per the never-queued rule). */}
      <TomorrowChoiceCard />

      {/* Diagnostic Placement invite — gentle, optional, dismisses at 100% */}
      <PlacementInviteCard />

      {/* Google Classroom assignments due this week — hides itself when empty
          (which is the entire pre-OAuth state). Wires the reusable
          LifecycleChip so Reagan can move work without leaving Today. */}
      <TodayClassroomCard />

      {/* Adult-only sidekick — Recently-graded Classroom assignments.
          Hidden when the adult panel is locked, hidden when the list is
          empty (pre-OAuth and pre-applyGradeReturn). */}
      {unlocked && <TodayClassroomGradedCard />}
      {unlocked && <TodayMomVoiceMemoCard />}
      {/* Push 2.10 (2026-05-17) — Forward calendar planner.
          Adult-only. Hides itself if no rows are proposed. */}
      {unlocked && <TodayForwardPlanCard />}
      {/* Push 2.14 (2026-05-17) — Adult quick-entry "What we actually did".
          Adult-only. Mom + Grandma type one line per block; the card
          parses + previews via today.applyAdultQuickEntry, then persists
          accepted lines via actuals.quickAdd (which auto-enqueues a
          Drive day-log rebuild). */}
      {unlocked && <TodayAdultQuickEntryCard />}

      {/* Push 2.9 (2026-05-17) — Kid-facing celebration card.
          Server-side returns only {id, subject, code, title} for done rows,
          so it's safe to mount unconditionally. */}
      <TodayCoveredRecapCard />

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
                    <TapEditPopover blockId={b.id} startTime={b.startTime ?? null} durationMin={b.durationMin ?? 30} />
                    <span className="text-xl" aria-hidden="true">{tint.emoji}</span>
                    {/* Push 42 (2026-05-13) — tap title to edit block.
                        For adults, the block title becomes a one-tap shortcut
                        to the full BlockEditor dialog so they can fix the
                        plan from Today without bouncing to AgendaEditor.
                        For Reagan, it stays a static title. */}
                    {unlocked ? (
                      <button
                        type="button"
                        className="font-display font-bold leading-tight text-left hover:underline focus:underline cursor-pointer"
                        style={{ ...rainbowInkStyle(i), fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)", background: "transparent", border: 0, padding: 0 }}
                        title="Adult: tap to edit this block"
                        onClick={() => setBlockEditor({ open: true, block: b as any })}
                        data-testid={`today-block-tap-edit-${b.id}`}
                      >
                        {b.title}
                      </button>
                    ) : (
                      <div className="font-display font-bold leading-tight" style={{ ...rainbowInkStyle(i), fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)" }}>{b.title}</div>
                    )}
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
                  {/* Push 119 (2026-05-13) — Slay Charge ⚡ daily mood-setter.
                      Renders ONLY inside the morning_vibe block (i.e., the
                      first block of the day). Joke or short clip + reroll.
                      Never creates a submission, never counts as schoolwork. */}
                  {(b.blockType === "morning_vibe" || b.blockType === "morning_warmup" || /slay charge/i.test(b.title || "")) && (
                    <SlayChargeCard dateIso={todayDate} />
                  )}
                  {/* Push 75 (2026-05-13) — generated payload hint:
                      shows printable + operable line ONLY when there's no
                      description AND no pageRefs already on the block. */}
                  <GeneratedBlockHint
                    blockId={b.id}
                    hasPageRefs={Array.isArray(b.pageRefs) && b.pageRefs.length > 0}
                    hasDescription={!!(b.description && b.description.trim().length > 0)}
                    todayDate={todayDate}
                  />
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
                    {/* Push 55 (2026-05-13) — Reagan-side reorder.
                       When adult is NOT unlocked, Reagan still gets up/down arrows
                       to reorder her own day. selfReorder rewrites sortOrder only;
                       startTime + durationMin are never touched (Mom/Grandma only). */}
                    {!unlocked && (selfReorderM as any) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/10 border-white/25 chalk-white hover:bg-white/20 h-8 px-3 text-xs"
                          onClick={() => {
                            const ids = blocks.map((x: any) => x.id);
                            if (i <= 0) return;
                            const reordered = ids.slice();
                            const tmp = reordered[i - 1];
                            reordered[i - 1] = reordered[i];
                            reordered[i] = tmp;
                            (selfReorderM as any).mutate(
                              { date: new Date().toISOString().slice(0, 10), orderedIds: reordered },
                              { onSuccess: () => { utils.plans.today.invalidate(); } },
                            );
                          }}
                          disabled={i === 0 || (selfReorderM as any)?.isPending}
                          title="Move this block earlier in my day"
                          data-testid="reagan-reorder-up"
                        >
                          ↑ Earlier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/10 border-white/25 chalk-white hover:bg-white/20 h-8 px-3 text-xs"
                          onClick={() => {
                            const ids = blocks.map((x: any) => x.id);
                            if (i >= ids.length - 1) return;
                            const reordered = ids.slice();
                            const tmp = reordered[i + 1];
                            reordered[i + 1] = reordered[i];
                            reordered[i] = tmp;
                            (selfReorderM as any).mutate(
                              { date: new Date().toISOString().slice(0, 10), orderedIds: reordered },
                              { onSuccess: () => { utils.plans.today.invalidate(); } },
                            );
                          }}
                          disabled={i === blocks.length - 1 || (selfReorderM as any)?.isPending}
                          title="Move this block later in my day"
                          data-testid="reagan-reorder-down"
                        >
                          ↓ Later
                        </Button>
                      </>
                    )}
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
                {unlocked && (
                  <ActualVsPlannedChips blockId={b.id} />
                )}
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
                    // Push 43 — if adult is unlocked, use the family-admin
                    // procedure (records adult as completer for grading).
                    // Otherwise Reagan herself marks via selfComplete.
                    const onDone = {
                      onSuccess: () => {
                        toast.success("Done!");
                        celebrateKiwi("Yay! 🎉 +1 sticker!");
                        utils.plans.today.invalidate();
                        // Push 50 — only show chips to Reagan (not adults grading)
                        if (!unlocked) setFeedbackForBlockId(b.id);
                      },
                    };
                    if (unlocked) {
                      completeM.mutate({ id: b.id }, onDone);
                    } else if (selfCompleteM) {
                      selfCompleteM.mutate({ id: b.id }, onDone);
                    } else {
                      completeM.mutate({ id: b.id }, onDone);
                    }
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
      {/* Push 50 (2026-05-13) — Reagan post-block feedback chips dialog. */}
      <Dialog
        open={feedbackForBlockId !== null}
        onOpenChange={(o) => { if (!o) setFeedbackForBlockId(null); }}
      >
        <DialogContent className="max-w-md p-0 bg-transparent border-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>How did that feel?</DialogTitle>
          </DialogHeader>
          {feedbackForBlockId !== null && (
            <FeedbackChips
              onDone={() => setFeedbackForBlockId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
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

/**
 * Push 39 (2026-05-13) — Adult quick-entry card for "what we actually did".
 *
 * UX intent: Mom finishes a block, glances at Today, and wants to log
 * "Reagan actually did 20 min of long division" without leaving the page.
 * This card avoids the full Agenda Editor for the simple case.
 *
 * Data path: trpc.actuals.quickAdd → db.recordActualEntry → automatic
 * day-log Drive rebuild via enqueueDayLogRebuildForDate. Coverage delta
 * + IEP analytics + 8 PM recap email all read from the same
 * actualAgendaEntries table, so the entry shows up everywhere with no
 * extra wiring.
 */
function TodayQuickEntryCard() {
  const dateISO = new Date().toISOString().slice(0, 10);
  const subjectsQ = trpc.subjects.list.useQuery();
  const recentQ = (trpc as any).actuals?.listForDate?.useQuery?.({ dateISO });
  const utils = trpc.useUtils();
  const addM = (trpc as any).actuals?.quickAdd?.useMutation?.({
    onSuccess: () => {
      // Re-fetch the inline recent list + the day-log readers.
      (utils as any).actuals?.listForDate?.invalidate?.({ dateISO });
      toast.success("Logged what Reagan actually did.");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Couldn't save — try again.");
    },
  });
  const deleteM = (trpc as any).actuals?.deleteRecent?.useMutation?.({
    onSuccess: () => {
      (utils as any).actuals?.listForDate?.invalidate?.({ dateISO });
      toast.success("Removed.");
    },
  });

  const [subjectSlug, setSubjectSlug] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("15");
  const [notes, setNotes] = useState<string>("");

  const subjects = (subjectsQ.data as Array<{ slug: string; name: string }> | undefined) ?? [];
  const recent = (recentQ?.data as Array<any> | undefined) ?? [];

  const canSubmit = subjectSlug.trim() !== "" && topic.trim() !== "" && Number(minutes) >= 0;

  function submit() {
    if (!canSubmit || !addM) return;
    addM.mutate({
      dateISO,
      subjectSlug,
      topic: topic.trim(),
      minutesSpent: Math.max(0, Math.min(600, Number(minutes) || 0)),
      notes: notes.trim() ? notes.trim() : null,
      source: "mom-input",
    });
    // Reset the lighter fields so Mom can log a second entry fast; keep
    // subject so multiple entries in the same subject only need topic +
    // minutes.
    setTopic("");
    setNotes("");
    setMinutes("15");
  }

  return (
    <Card className="classroom-card p-4" data-testid="today-quick-entry-card">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="font-display text-sm font-semibold chalk-white">
          What we actually did
          <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
            Mom/Grandma quick log
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Auto-syncs to Drive day-log + Analytics
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[140px_1fr_80px_auto] items-center">
        <Select value={subjectSlug} onValueChange={setSubjectSlug}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Subject…" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Topic (e.g. long division — remainders)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          max={600}
          placeholder="min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-label="Minutes spent"
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={!canSubmit || addM?.isPending}
          data-testid="today-quick-entry-submit"
        >
          {addM?.isPending ? "Logging…" : "+ Log"}
        </Button>
      </div>
      <Input
        className="mt-2"
        placeholder="Optional notes (great focus, struggled with regrouping, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {recent.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="today-quick-entry-recent">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Today so far ({recent.length})
          </div>
          {recent.slice(-6).reverse().map((r: any) => {
            // Push 44 — Kiwi-listened provenance badge in the recent
            // entries list so Mom/Grandma can spot which rows came from
            // passive listening vs their own manual entry.
            const fromKiwi = r.source === "kiwi-listened";
            return (
            <div
              key={r.id}
              data-source={r.source}
              className="flex items-center gap-2 flex-wrap rounded border border-border/60 bg-card/40 px-2 py-1.5 text-xs"
            >
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted opacity-80">
                {r.subjectSlug}
              </span>
              {fromKiwi && (
                <span
                  aria-label="Captured by Kiwi listening"
                  title="Captured by Kiwi listening"
                  className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-amber-300/15 text-amber-200"
                  data-testid="kiwi-listened-badge"
                >
                  <span aria-hidden>🎙️</span>
                  <span aria-hidden>🐥</span>
                </span>
              )}
              <span className="flex-1 min-w-0 truncate" title={r.topic}>{r.topic}</span>
              <span className="opacity-70">{r.minutesSpent} min</span>
              <span className="opacity-50 text-[10px]">{r.source}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() => deleteM?.mutate({ id: r.id })}
                disabled={deleteM?.isPending}
              >
                Undo
              </Button>
            </div>
          );
          })}
        </div>
      )}
    </Card>
  );
}


/**
 * Push 40 (2026-05-13) — Per-block "Actual-vs-Planned" chip strip.
 *
 * Renders directly under the planned block actions. Pulls
 * trpc.actuals.vsPlanned once per day (cached at the strip level via
 * react-query default dedupe) and filters to the rows that map to this
 * block. Hidden when adult is locked OR when there are no actuals on
 * the block (no clutter for kids, no noise for unfilled blocks).
 */
function ActualVsPlannedChips({ blockId }: { blockId: number }) {
  const dateISO = new Date().toISOString().slice(0, 10);
  const q = (trpc as any).actuals?.vsPlanned?.useQuery?.({ dateISO }, { staleTime: 30_000 });
  const data = q?.data as any;
  if (!data) return null;
  const block = (data.blocks ?? []).find((b: any) => b.id === blockId);
  if (!block || !block.actuals || block.actuals.length === 0) return null;
  const total = block.actuals.reduce((s: number, a: any) => s + (a.minutesSpent || 0), 0);
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mt-1 ml-1"
      data-testid={`actual-vs-planned-chips-${blockId}`}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-70 chalk-white">Actual:</span>
      {block.actuals.slice(0, 3).map((a: any) => {
        // Push 44 (2026-05-13) — Kiwi-listened provenance badge.
        // Any actual entry whose source is 'kiwi-listened' gets a tiny
        // mic+chick icon so adults can tell at a glance which entries
        // came from passive listening vs. manual mom/grandma entry.
        const fromKiwi = a.source === "kiwi-listened";
        return (
          <span
            key={a.id}
            title={`${a.notes || a.source}${fromKiwi ? " — captured by Kiwi listening" : ""}`}
            data-source={a.source}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] " +
              (a.pinned
                ? "bg-emerald-400/15 border-emerald-300/40 text-emerald-50"
                : "bg-amber-300/10 border-amber-300/30 text-amber-50")
            }
          >
            <span aria-hidden>{a.pinned ? "✓" : "≈"}</span>
            {fromKiwi && (
              <span
                aria-label="Captured by Kiwi listening"
                title="Captured by Kiwi listening"
                className="inline-flex items-center gap-0.5 text-amber-200"
                data-testid="kiwi-listened-badge"
              >
                <span aria-hidden>🎙️</span>
                <span aria-hidden>🐥</span>
              </span>
            )}
            <span className="truncate max-w-[14rem]">{a.topic}</span>
            <span className="opacity-70">{a.minutesSpent}m</span>
          </span>
        );
      })}
      {block.actuals.length > 3 && (
        <span className="text-[10px] opacity-60">+{block.actuals.length - 3} more</span>
      )}
      <span className="text-[10px] opacity-70 ml-1">= {total}m</span>
    </div>
  );
}


/**
 * Push 41 (2026-05-13) — Today mood timeline strip.
 *
 * Pulls trpc.listening.moodTimeline once, renders a horizontal row of
 * 12 cells. Each cell is colored by inferred mood; tooltip exposes the
 * raw emotion + comfort numbers + bin window. The strip is hidden
 * entirely when there are no relevant chunks for the day so Mom never
 * sees a flat empty bar.
 */
function TodayMoodTimelineStrip() {
  const dateISO = new Date().toISOString().slice(0, 10);
  const q = (trpc as any).listening?.moodTimeline?.useQuery?.(
    { date: dateISO, binCount: 12 },
    { staleTime: 60_000 },
  );
  const data = q?.data as {
    bins: Array<{
      binIndex: number;
      bucketStart: number;
      bucketEnd: number;
      count: number;
      avgEmotion: number | null;
      avgComfort: number | null;
      mood: "green" | "yellow" | "red" | null;
    }>;
    totals: { chunks: number; relevantChunks: number };
  } | undefined;

  if (!data || data.totals.relevantChunks === 0) return null;

  const colorFor = (m: string | null): string => {
    if (m === "green") return "#36c66f";
    if (m === "yellow") return "#f5c84b";
    if (m === "red") return "#e9543a";
    return "#3a3a3a";
  };

  const fmtTime = (t: number) =>
    new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <Card className="classroom-card p-4" data-testid="today-mood-timeline">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="font-display text-sm font-semibold chalk-white">
          Mood timeline
          <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
            from ambient listening · adult view
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {data.totals.relevantChunks} relevant chunks / {data.totals.chunks} total
        </div>
      </div>
      <div className="flex items-stretch gap-1" role="list" aria-label="Mood timeline bins">
        {data.bins.map((b) => (
          <div
            key={b.binIndex}
            role="listitem"
            title={
              b.count > 0
                ? `${fmtTime(b.bucketStart)}–${fmtTime(b.bucketEnd)} · ${b.count} chunk(s)\n` +
                  `emotion ${b.avgEmotion ?? "—"} · comfort ${b.avgComfort ?? "—"} · ${b.mood ?? "no data"}`
                : `${fmtTime(b.bucketStart)}–${fmtTime(b.bucketEnd)} · no data`
            }
            className="flex-1 h-9 rounded-md border border-white/10"
            style={{
              backgroundColor: colorFor(b.mood),
              opacity: b.count === 0 ? 0.25 : 0.9,
            }}
            data-mood={b.mood ?? "none"}
            data-count={b.count}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
        <span>{fmtTime(data.bins[0]?.bucketStart ?? Date.now())}</span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#36c66f" }} />green
          <span className="inline-block w-2 h-2 rounded-full ml-2 mr-1" style={{ background: "#f5c84b" }} />yellow
          <span className="inline-block w-2 h-2 rounded-full ml-2 mr-1" style={{ background: "#e9543a" }} />red
        </span>
        <span>{fmtTime(data.bins[data.bins.length - 1]?.bucketEnd ?? Date.now())}</span>
      </div>
    </Card>
  );
}
