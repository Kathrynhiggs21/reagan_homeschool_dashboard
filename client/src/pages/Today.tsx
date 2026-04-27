import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWhisper } from "@/contexts/WhisperContext";
import { Heart, Sparkles, BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ZONES = [
  { z: "green", emoji: "🌿", label: "Feeling good", color: "bg-emerald-100 hover:bg-emerald-200 border-emerald-300" },
  { z: "yellow", emoji: "🌼", label: "Kinda meh", color: "bg-amber-100 hover:bg-amber-200 border-amber-300" },
  { z: "red", emoji: "🌹", label: "Heavy day", color: "bg-rose-100 hover:bg-rose-200 border-rose-300" },
];

export default function Today() {
  const { adultPresent, companionAvatar, companionName, setOpen } = useWhisper();
  const profile = trpc.profile.get.useQuery();
  const today = trpc.plans.today.useQuery();
  const struggleM = trpc.struggles.log.useMutation({ onSuccess: () => toast.success("Logged. Thanks for telling me.") });
  const moodM = trpc.mood.log.useMutation({ onSuccess: () => toast.success("Got it.") });
  const completeM = trpc.blocks.complete.useMutation();
  const specialDay = trpc.specialDays.today.useQuery();
  const encouragement = trpc.encouragement.list.useQuery({ unreadOnly: false });
  const today_str = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const utils = trpc.useUtils();

  const blocks = today.data?.blocks ?? [];
  const planId = today.data?.plan?.id;

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

      <div>
        <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Your day, in cozy blocks</h2>
        {today.isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
        {blocks.length === 0 && (
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
                      const desc = prompt("What was hard? (optional)");
                      if (desc !== null) struggleM.mutate({ blockId: b.id, subjectSlug: b.subjectSlug || null, description: desc, intensity: "yellow" });
                    }}>💛 Struggle</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
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
    </div>
  );
}
