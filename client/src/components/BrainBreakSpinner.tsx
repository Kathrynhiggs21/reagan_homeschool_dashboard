import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { celebrateKiwi } from "./KiwiPerch";

/**
 * BrainBreakSpinner — gentle reset activity. Reagan hits the button and gets
 * one of 12 short brain-break prompts. Kiwi flaps. Optional 30/60-sec timer.
 */

const BREAKS: { emoji: string; title: string; body: string; sec?: number }[] = [
  { emoji: "🦜", title: "Bird stretches", body: "Flap your arms like wings. Slow. Fast. Slow again.", sec: 30 },
  { emoji: "💧", title: "Drink water", body: "Go get a big sip. Come back when you're ready." },
  { emoji: "🌬️", title: "Five deep breaths", body: "Breathe in for 4. Hold for 2. Out for 6. Five times.", sec: 60 },
  { emoji: "🤸", title: "Ten jumping jacks", body: "Count out loud!", sec: 30 },
  { emoji: "🫧", title: "Look out the window", body: "Find 3 things that are alive. Report back to Kiwi." },
  { emoji: "🐢", title: "Slow walk", body: "Walk to the other end of the house. Slower than a turtle.", sec: 60 },
  { emoji: "💛", title: "Hug someone or Kiwi", body: "Pick a person, pet, or bird." },
  { emoji: "🎨", title: "Doodle one shape", body: "Anything. Just one line on the Scratch Pad." },
  { emoji: "🙃", title: "Upside-down silly", body: "Bend over and say hi to the floor. Stand up slow." },
  { emoji: "🧊", title: "Splash cold water", body: "On your face or wrists. It resets your body.", sec: 30 },
  { emoji: "🎵", title: "Dance it off", body: "Pick a song and dance for one chorus.", sec: 60 },
  { emoji: "🌞", title: "Name one good thing", body: "One good thing about right now. Out loud." },
];

export default function BrainBreakSpinner() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<(typeof BREAKS)[number] | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [ticking, setTicking] = useState(false);

  const spin = () => {
    const p = BREAKS[Math.floor(Math.random() * BREAKS.length)];
    setPick(p);
    setTimer(p.sec ?? 0);
    setTicking(false);
    setOpen(true);
    celebrateKiwi();
  };

  const startTimer = () => {
    if (!pick?.sec) return;
    setTicking(true);
    let t = pick.sec;
    setTimer(t);
    const iv = setInterval(() => {
      t -= 1;
      setTimer(t);
      if (t <= 0) {
        clearInterval(iv);
        setTicking(false);
        celebrateKiwi();
      }
    }, 1000);
  };

  return (
    <>
      <Card
        className="classroom-card p-4 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(250,204,21,0.14), rgba(236,72,153,0.12))",
        }}
      >
        <div className="w-12 h-12 rounded-xl bg-yellow-300 flex items-center justify-center text-2xl">
          🧘
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-base">Brain break</div>
          <div className="text-xs text-muted-foreground">
            Wiggly? Stuck? Spin for a 30-second reset.
          </div>
        </div>
        <Button onClick={spin} className="rounded-full" variant="secondary">
          <Sparkles className="w-4 h-4 mr-1" /> Spin
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Brain break!</DialogTitle>
          </DialogHeader>
          {pick && (
            <div className="text-center py-4 space-y-3">
              <div className="text-6xl">{pick.emoji}</div>
              <div className="font-display text-xl font-semibold">{pick.title}</div>
              <div className="text-sm text-muted-foreground">{pick.body}</div>
              {pick.sec && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="text-4xl font-bold tabular-nums">
                    {timer > 0 ? `${timer}s` : pick.sec + "s"}
                  </div>
                  <Button onClick={startTimer} disabled={ticking} className="rounded-full">
                    {ticking ? "Keep going!" : "Start timer"}
                  </Button>
                </div>
              )}
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="secondary" onClick={() => { setPick(null); spin(); }}>
                  Spin again
                </Button>
                <Button onClick={() => setOpen(false)}>Done, I feel better</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
