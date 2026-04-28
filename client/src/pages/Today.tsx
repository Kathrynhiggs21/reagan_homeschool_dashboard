import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWhisper } from "@/contexts/WhisperContext";
import { useState } from "react";
import { toast } from "sonner";

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
const CHIP_COLORS = ["chip-pink", "chip-yellow", "chip-cyan", "chip-lime", "chip-coral", "chip-violet"] as const;

function blockTimeLabel(i: number): string {
  // Give each block a clean time label (pretend a typical school schedule).
  // We intentionally keep this cosmetic — real scheduling isn't the point.
  const starts = ["8:30", "9:15", "10:00", "10:45", "11:30", "1:00", "1:45", "2:30"];
  return starts[i % starts.length];
}

export default function Today() {
  const { companionAvatar, companionName, setOpen } = useWhisper();
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
      {/* Hero chalkboard — bold, simple, classroom-style */}
      <header className="chalkboard relative">
        <div className="dotted-trim absolute left-6 right-6 top-3" aria-hidden />
        <div className="pt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="font-chalk-hand text-2xl chalk-yellow leading-none">{today_str}</div>
            <h1 className="font-display text-4xl md:text-5xl mt-2 leading-none">
              <span className="chalk-pink">Good</span>{" "}
              <span className="chalk-yellow">Morning,</span>{" "}
              <span className="chalk-cyan">{(profile.data?.studentName || "Reagan").split(" ")[0]}</span>
              <span className="chalk-lime">!</span>
            </h1>
            <p className="font-display text-base mt-3 chalk-white opacity-85">
              Today's schedule is on the board.
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-display"
          >
            <span className="text-lg mr-2">{companionAvatar}</span> Ask {companionName}
          </Button>
        </div>
        <div className="dotted-trim absolute left-6 right-6 bottom-3" aria-hidden />
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

      {/* Check-in strip (was "How are you feeling?" big pastel cards) */}
      <Card className="classroom-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-display text-sm font-semibold chalk-white">Check-in</div>
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
        <div className="space-y-2">
          {blocks.map((b: any, i: number) => {
            const chip = CHIP_COLORS[i % CHIP_COLORS.length];
            const isDone = b.status === "complete";
            return (
              <div key={b.id} className={`schedule-row ${isDone ? "opacity-60" : ""}`}>
                <span className={`time-chip ${chip}`}>{blockTimeLabel(i)}</span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-lg leading-none mr-1">{b.emoji || "📝"}</span>
                    <span className="font-display font-semibold text-[15px]">{b.title}</span>
                    {b.subjectSlug && (
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{b.subjectSlug}</span>
                    )}
                  </div>
                  {b.description && (
                    <p className="text-sm text-neutral-600 mt-0.5 truncate">{b.description}</p>
                  )}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {!isDone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-transparent h-7 px-2 text-xs"
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
                      className="h-7 px-2 text-xs"
                      onClick={() => setOpen(true)}
                    >
                      {companionAvatar} Help
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-neutral-500"
                      onClick={() => setStruggleDialog({ open: true, blockId: b.id, subjectSlug: b.subjectSlug })}
                    >
                      Struggle
                    </Button>
                  </div>
                </div>
                <div />
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
