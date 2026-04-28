import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWhisper } from "@/contexts/WhisperContext";
import { Heart, Sparkles, BookOpen, Smile, Video, Moon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ZONES = [
  { z: "green", emoji: "🌿", label: "Feeling good", color: "bg-emerald-100 hover:bg-emerald-200 border-emerald-300" },
  { z: "yellow", emoji: "🌼", label: "Kinda meh", color: "bg-amber-100 hover:bg-amber-200 border-amber-300" },
  { z: "red", emoji: "🌹", label: "Heavy day", color: "bg-rose-100 hover:bg-rose-200 border-rose-300" },
];

const STRUGGLE_INTENSITIES = [
  { value: "yellow", emoji: "🌼", label: "Kinda hard", color: "border-amber-300 bg-amber-50 hover:bg-amber-100" },
  { value: "red", emoji: "🌹", label: "Really hard", color: "border-rose-300 bg-rose-50 hover:bg-rose-100" },
];

const COMMON_TRIGGERS = ["too long", "too hard", "boring", "noisy", "tired", "sad", "frustrated", "didn't get it", "felt watched"];
const COMMON_HELPERS = ["a break", "a snack", "the parakeets", "outside", "drawing", "Whisper helped", "Mom helped"];

export default function Today() {
  const { adultPresent, companionAvatar, companionName, setOpen } = useWhisper();
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged. Thank you for telling me. 💛") });
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
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-hand text-xl text-muted-foreground">{today_str}</div>
          <h1 className="text-3xl font-display font-semibold mt-1">
            Hi {(profile.data?.studentName || "Reagan").split(" ")[0]} <span className="font-hand text-2xl text-primary">— the Animal Whisperer</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">No timing today, just your pace. {companionName} is right here. 💛</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg" className="rounded-full">
          <span className="text-lg mr-2">{companionAvatar}</span> Talk to {companionName}
        </Button>
      </header>

      {specialDay.data && (
        <Card className="cozy-card p-4 bg-gradient-to-r from-amber-50 to-rose-50 border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{(specialDay.data as any).emoji || "✨"}</span>
            <div className="flex-1">
              <div className="font-semibold text-base">Today: {(specialDay.data as any).name}</div>
              <p className="text-sm text-muted-foreground mt-1">{(specialDay.data as any).description}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="cozy-card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400"/> How are you feeling?</div>
        <div className="grid grid-cols-3 gap-3">
          {ZONES.map(z => (
            <button key={z.z} onClick={() => planId && moodM.mutate({ planId, zone: z.z as any })}
              className={`${z.color} border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition`}>
              <span className="text-3xl">{z.emoji}</span>
              <span className="text-sm font-medium">{z.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* End-of-day celebration */}
      {(() => {
        const total = blocks.length;
        const done = blocks.filter((b: any) => b.status === "complete").length;
        if (total > 0 && done === total) {
          return (
            <Card className="cozy-card p-6 bg-gradient-to-br from-emerald-50 via-amber-50 to-rose-50 border-emerald-200">
              <div className="flex items-start gap-4">
                <span className="text-5xl">🌿</span>
                <div className="flex-1">
                  <div className="font-display font-semibold text-xl">You did the whole day, Reagan.</div>
                  <p className="font-hand text-lg mt-1 leading-snug">Every block. The animals saw you show up, and so did I. Real Animal Whisperer energy. Go love on the parakeets. 💛</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="bg-card" onClick={() => recap.refetch()}>{companionAvatar} Read me {companionName}'s note</Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        }
        return null;
      })()}

      <div>
        <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Your day, in cozy blocks</h2>
        {today.isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
        {!today.isLoading && blocks.length === 0 && (
          <Card className="cozy-card p-6 text-center text-muted-foreground">
            <p className="font-hand text-xl mb-2">No blocks built for today yet.</p>
            <p className="text-sm">Adults can build today's plan from the Tutor Handoff page.</p>
          </Card>
        )}
        <div className="space-y-3">
          {blocks.map((b: any) => (
            <Card key={b.id} className={`cozy-card p-4 ${b.status === "complete" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl pt-0.5">{b.emoji || "📝"}</span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-base">{b.title}</h3>
                    {b.subjectSlug && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.subjectSlug}</span>}
                  </div>
                  {b.description && <p className="text-sm text-muted-foreground mt-1">{b.description}</p>}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {b.status !== "complete" && (
                      <Button size="sm" variant="outline" className="bg-card" onClick={() => {
                        completeM.mutate({ id: b.id }, { onSuccess: () => { toast.success("You did that. 💛"); utils.plans.today.invalidate(); }});
                      }}>✓ Done</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{companionAvatar} Help</Button>
                    <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => {
                      setStruggleDialog({ open: true, blockId: b.id, subjectSlug: b.subjectSlug });
                    }}>💛 Struggle</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Sunshine Drop */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="cozy-card p-5 bg-gradient-to-br from-amber-50 to-yellow-50/50 border-amber-200">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Smile className="w-4 h-4 text-amber-500"/> Sunshine Drop</div>
          <div className="font-hand text-lg leading-snug">{joke.data?.text || "Pulling a joke from the joke jar..."}</div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="bg-card" onClick={() => joke.refetch()}>Another one</Button>
            <Button size="sm" variant="outline" className="bg-card" onClick={() => setVideoOpen(true)}><Video className="w-3 h-3 mr-1"/> Funny animal video</Button>
          </div>
        </Card>

        <Card className="cozy-card p-5 bg-gradient-to-br from-rose-50/50 to-amber-50/50 border-rose-100">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Moon className="w-4 h-4 text-rose-400"/> {companionName}'s end-of-day note</div>
          <div className="font-hand text-base leading-snug whitespace-pre-line">{recap.data?.recap || "I'll write you a real note when the day's done. 💛"}</div>
        </Card>
      </div>

      {encouragement.data && encouragement.data.length > 0 && (
        <Card className="cozy-card p-5 bg-gradient-to-br from-amber-50/60 to-rose-50/40 border-amber-200">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500"/> Notes for you</div>
          <div className="space-y-2">
            {encouragement.data.slice(0, 3).map((n: any) => (
              <div key={n.id} className="bg-card rounded-xl p-3 border border-amber-100">
                <div className="font-hand text-base">"{n.content}"</div>
                <div className="text-xs text-muted-foreground mt-1">— {n.fromName}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Struggle dialog */}
      <Dialog open={struggleDialog.open} onOpenChange={(o) => setStruggleDialog(s => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">💛 Tell me what's hard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">No wrong answers. Just info, not failure.</p>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider">How hard?</div>
              <div className="grid grid-cols-2 gap-2">
                {STRUGGLE_INTENSITIES.map(s => (
                  <button key={s.value} onClick={() => setIntensity(s.value as any)}
                    className={`${s.color} border-2 rounded-xl p-3 flex flex-col items-center gap-1 transition ${intensity === s.value ? "ring-2 ring-primary" : ""}`}>
                    <span className="text-2xl">{s.emoji}</span>
                    <span className="text-xs font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider">What was tough? (tap any)</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TRIGGERS.map(t => (
                  <button key={t} onClick={() => toggle(triggers, setTriggers, t)}
                    className={`px-3 py-1 rounded-full text-xs border ${triggers.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider">What helped (or might help)?</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_HELPERS.map(h => (
                  <button key={h} onClick={() => toggle(helpers, setHelpers, h)}
                    className={`px-3 py-1 rounded-full text-xs border ${helpers.includes(h) ? "bg-emerald-500 text-white border-emerald-500" : "bg-card border-border"}`}>{h}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider">Anything else? (optional)</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                className="w-full rounded-xl border border-border bg-card p-2 text-sm"
                placeholder="Just a few words if you want..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStruggleDialog({ open: false })}>Not now</Button>
            <Button onClick={submitStruggle}>💛 Save it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Animal video */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">🦆 Funny animal break</DialogTitle></DialogHeader>
          {animalVideo.data ? (
            <div>
              <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                <iframe src={animalVideo.data.embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
              </div>
              <div className="text-sm text-muted-foreground mt-2 text-center font-hand">{animalVideo.data.title}</div>
            </div>
          ) : <div className="py-8 text-center text-sm text-muted-foreground">finding something good...</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => animalVideo.refetch()}>Another one</Button>
            <Button onClick={() => setVideoOpen(false)}>Done laughing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
