import { trpc } from "@/lib/trpc";
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
import SubjectColorKey from "@/components/SubjectColorKey";
import { subjectTint, tintCardStyle, tintInkStyle, tintPillStyle, rainbowCardStyle, rainbowPillStyle, rainbowInkStyle, rainbowStop } from "@/lib/subjectColors";
import { celebrateKiwi } from "@/components/KiwiPerch";
import FlockWidget from "@/components/FlockWidget";
import WhiteboardStrip from "@/components/WhiteboardStrip";
import TVBox from "@/components/TVBox";
import BrainBreakSpinner from "@/components/BrainBreakSpinner";

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
  const { unlocked } = useAdultLock();
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged.") });
  const moodM = trpc.mood.log.useMutation({ onSuccess: () => toast.success("Got it.") });
  const completeM = trpc.blocks.complete.useMutation();
  const specialDay = trpc.specialDays.today.useQuery();
  const encouragement = trpc.encouragement.list.useQuery({ unreadOnly: false });
  const joke = trpc.kiwi.joke.useQuery();
  const recap = trpc.kiwi.endOfDayRecap.useQuery();
  const utils = trpc.useUtils();

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
  const [turnIn, setTurnIn] = useState<{ open: boolean; block?: { id: number; title?: string; subjectSlug?: string | null } }>({ open: false });

  const today_str = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const blocks = today.data?.blocks ?? [];
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
    <div className="space-y-6">
      {/* Header — calm chalkboard strip, rainbow multi-color title. No ombre banner. */}
      <header className="relative rounded-2xl p-5 md:p-7" style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 30px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="font-chalk-hand text-2xl md:text-3xl leading-none" style={{ color: "#ffd97a", textShadow: "0 0 1px rgba(255,255,255,0.25)" }}>{today_str}</div>
            <h1 className="font-display mt-2 leading-none flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ fontSize: "clamp(2.5rem, 6vw, 4.75rem)", letterSpacing: "-0.01em" }}>
              {(() => {
                const first = (profile.data?.studentName || "Reagan").split(" ")[0];
                const words = [
                  { t: "Good",      c: "#ff9fb2" }, // coral pink
                  { t: "Morning,",  c: "#ffd97a" }, // butter yellow
                  { t: first + "!", c: "#7fe3c4" }, // mint
                ];
                return words.map((w, i) => (
                  <span key={i} className="inline-block" style={{
                    color: w.c,
                    textShadow: "0 0 1px rgba(255,255,255,0.35), 0 3px 0 rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.4)",
                  }}>
                    {w.t}
                  </span>
                ));
              })()}
            </h1>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-display text-base px-5 py-6 shadow-[0_6px_0_rgba(0,0,0,0.35),0_0_18px_rgba(255,216,106,0.25)]"
          >
            Ask {companionName}
          </Button>
        </div>
      </header>

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

      {/* Tour Mode — calm pinned strip, no ombre gradient */}
      <TourModeCard />
      {/* Today's Schedule board */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl font-semibold chalk-white">Today's Schedule</h2>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">{done} / {total} done</span>
          )}
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
                  </div>
                  {b.description && (
                    <p className="mt-1 chalk-white/90" style={{ fontSize: "0.95rem", opacity: 0.82, lineHeight: 1.35 }}>{b.description}</p>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
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
                  onClick={() => {
                    if (isDone) return;
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

      {/* ===== Widget grid (everything-after-the-schedule) ===== */}
      <section className="pt-2">
        <h2 className="font-display font-semibold mb-3 flex flex-wrap items-baseline gap-x-2" style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)" }}>
          <span style={{ color: "#ff9fb2", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>Your</span>
          <span style={{ color: "#ffd97a", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>classroom</span>
          <span style={{ color: "#7fe3c4", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>extras</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="widget-tile"><FlockWidget /></div>
          <div className="widget-tile"><WhiteboardStrip /></div>
          <div className="widget-tile"><TVBox /></div>
          <div className="widget-tile"><BrainBreakSpinner /></div>
          <div className="widget-tile"><CoinStickerStrip /></div>
          <div className="widget-tile">
            <div className="rounded-2xl p-4 h-full" style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))",
              border: "2px solid rgba(255,216,106,0.35)",
              boxShadow: "0 6px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,216,106,0.12)",
            }}>
              <div className="font-display font-semibold text-lg mb-2" style={{ color: "#ffd97a", textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}>Brain Break 🧠</div>
              <div className="text-[15px] leading-snug chalk-white">{joke.data?.text || "Pulling a joke..."}</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="bg-transparent h-8 px-3 text-xs" onClick={() => joke.refetch()}>Another</Button>
                <Button size="sm" variant="outline" className="bg-transparent h-8 px-3 text-xs" onClick={() => setVideoOpen(true)}>Animal video</Button>
              </div>
            </div>
          </div>
          <div className="widget-tile md:col-span-2">
            <div className="rounded-2xl p-4 h-full" style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))",
              border: "2px solid rgba(127,227,196,0.35)",
              boxShadow: "0 6px 0 rgba(0,0,0,0.3), 0 0 18px rgba(127,227,196,0.12)",
            }}>
              <div className="font-display font-semibold text-lg mb-2" style={{ color: "#7fe3c4", textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}>{companionName}'s note 📝</div>
              <div className="text-[15px] leading-snug whitespace-pre-line chalk-white/90">
                {recap.data?.recap || "A short note will appear here at the end of the day."}
              </div>
            </div>
          </div>
          {encouragement.data && encouragement.data.length > 0 && (
            <div className="widget-tile md:col-span-3">
              <div className="rounded-2xl p-4 h-full" style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))",
                border: "2px solid rgba(255,159,178,0.35)",
                boxShadow: "0 6px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,159,178,0.12)",
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
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(180deg, rgba(255,216,106,0.1), rgba(255,159,178,0.06))",
        border: "2px solid rgba(255,216,106,0.45)",
        borderLeft: "10px solid #ffd97a",
        boxShadow: "0 6px 0 rgba(0,0,0,0.3), 0 0 22px rgba(255,216,106,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl" style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.4))" }}>{msg.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#ffd97a" }}>{msg.tag}</div>
          <div className="font-display font-bold leading-tight" style={{ color: "#ff9fb2", fontSize: "clamp(1.35rem, 3vw, 1.8rem)", textShadow: "0 2px 0 rgba(0,0,0,0.4)" }}>{msg.title}</div>
          <p className="mt-1 leading-snug chalk-white" style={{ fontSize: "1.05rem", opacity: 0.9 }}>{msg.body}</p>
          {msg.chip && (
            <div className="inline-block mt-3 px-4 py-2 rounded-full text-sm font-semibold" style={{
              background: "rgba(255,216,106,0.95)",
              color: "#4a3600",
              boxShadow: "0 3px 0 rgba(0,0,0,0.35)",
            }}>
              {msg.chip}
            </div>
          )}
        </div>
      </div>
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
