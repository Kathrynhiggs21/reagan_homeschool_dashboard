import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWhisper } from "@/contexts/WhisperContext";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState } from "react";
import { toast } from "sonner";
import BlockEditor, { type ExistingBlock } from "@/components/BlockEditor";
import GradeBlockDialog from "@/components/GradeBlockDialog";

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
  const { companionAvatar, companionName, setOpen } = useWhisper();
  const { unlocked } = useAdultLock();
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged.") });
  const moodM = trpc.mood.log.useMutation({ onSuccess: () => toast.success("Got it.") });
  const completeM = trpc.blocks.complete.useMutation();
  const specialDay = trpc.specialDays.today.useQuery();
  const encouragement = trpc.encouragement.list.useQuery({ unreadOnly: false });
  const joke = trpc.whisper.joke.useQuery();
  const recap = trpc.whisper.endOfDayRecap.useQuery();
  const utils = trpc.useUtils();

  const [struggleDialog, setStruggleDialog] = useState<{ open: boolean; blockId?: number; subjectSlug?: string | null }>({ open: false });
  const [intensity, setIntensity] = useState<"yellow" | "red">("yellow");
  const [description, setDescription] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const animalVideo = trpc.whisper.funnyAnimalVideo.useQuery(undefined, { enabled: videoOpen });
  // Adult edit state
  const [blockEditor, setBlockEditor] = useState<{ open: boolean; block?: ExistingBlock }>({ open: false });
  const [gradeDialog, setGradeDialog] = useState<{ open: boolean; block?: { id: number; title?: string; subjectSlug?: string | null } }>({ open: false });

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
      {/* Hero chalkboard — real chalkboard texture, bold multicolor chalk */}
      <header className="chalkboard relative">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="font-chalk-hand text-2xl leading-none chalk-yellow">{today_str}</div>
            <h1 className="font-display text-4xl md:text-6xl mt-2 leading-none chalk-white">
              Good Morning, {(profile.data?.studentName || "Reagan").split(" ")[0]}!
            </h1>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-display"
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
            const chip = CHIP_COLORS[i % CHIP_COLORS.length];
            const isDone = b.status === "complete";
            return (
              <div key={b.id} className={`schedule-row ${isDone ? "opacity-55" : ""}`}>
                <img src={tileFor(b.subjectSlug)} alt="" className="subject-tile" />
                <span className={`time-chip ${chip}`}>{blockTimeLabel(i)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-base leading-tight">{b.title}</div>
                  {b.description && (
                    <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">{b.description}</p>
                  )}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {!isDone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/60 border-neutral-300 text-neutral-900 hover:bg-white h-7 px-2 text-xs"
                        onClick={() => {
                          completeM.mutate({ id: b.id }, { onSuccess: () => { toast.success("Done."); utils.plans.today.invalidate(); }});
                        }}
                      >
                        ✓ Done
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-neutral-700 hover:bg-white"
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
                          className="h-7 px-2 text-xs text-neutral-500 hover:bg-white"
                          onClick={() => setStruggleDialog({ open: true, blockId: b.id, subjectSlug: b.subjectSlug })}
                          title="Adult-only: log a moment Reagan found hard"
                        >
                          Note a struggle
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Breaks + notes row (was "Sunshine Drop" + emotional recap) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="classroom-card p-4">
          <div className="font-display text-sm font-semibold mb-2">Brain Break</div>
          <div className="text-[15px] leading-snug">{joke.data?.text || "Pulling a joke..."}</div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="bg-transparent h-7 px-2 text-xs" onClick={() => joke.refetch()}>
              Another
            </Button>
            <Button size="sm" variant="outline" className="bg-transparent h-7 px-2 text-xs" onClick={() => setVideoOpen(true)}>
              Animal video
            </Button>
          </div>
        </Card>

        <Card className="classroom-card p-4">
          <div className="font-display text-sm font-semibold mb-2">{companionName}'s note</div>
          <div className="text-[15px] leading-snug whitespace-pre-line text-muted-foreground">
            {recap.data?.recap || "A short note will appear here at the end of the day."}
          </div>
        </Card>
      </div>

      {encouragement.data && encouragement.data.length > 0 && (
        <Card className="classroom-card p-4">
          <div className="font-display text-sm font-semibold mb-3">Notes for you</div>
          <div className="space-y-2">
            {encouragement.data.slice(0, 3).map((n: any) => (
              <div key={n.id} className="rounded-md p-3 border border-border bg-white/5">
                <div className="text-[15px]">"{n.content}"</div>
                <div className="text-xs text-muted-foreground mt-1">— {n.fromName}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
        block={gradeDialog.block}
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
