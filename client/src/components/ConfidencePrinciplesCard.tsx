import { Card } from "@/components/ui/card";

/**
 * ConfidencePrinciplesCard
 *
 * Anchors every other feature of the dashboard. Surfaced inside Settings (adult)
 * AND on Reagan's About Me / Today page in plain language. Tutors should read
 * this before starting a session.
 *
 * North Star: feel safe → understand → catch up → graduate the IEP.
 */
export default function ConfidencePrinciplesCard() {
  return (
    <Card className="classroom-card p-5 space-y-4 border-2 border-amber-300/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-chalk-hand text-lg leading-none text-amber-500">North Star</div>
          <h2 className="font-display text-2xl mt-1">How this classroom works</h2>
        </div>
        <span className="text-3xl" aria-hidden>🪶</span>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <Principle
          emoji="🛟"
          title="Feel safe first"
          body="No timers Reagan can see. No red marks. No 'wrong.' Kiwi never tests her — she's a guide, not a quiz."
        />
        <Principle
          emoji="🧠"
          title="Understand, then move on"
          body="Every skill can be learned through a story, a picture, building it, a video, or practice. Reagan picks the path. A block ends when she says 'I get it' — not when a clock runs out."
        />
        <Principle
          emoji="📈"
          title="Catch up on purpose"
          body="A daily 15-minute Skill-Builder block targets the exact next skill on her ladder, based on her real MAP/Acadience scores. She sees her ladder going up — that's the reward."
        />
        <Principle
          emoji="✨"
          title="She IS smart"
          body="Kiwi reflects effort and strength back constantly: 'You figured that out yourself.' 'This used to be hard — look at you now.' The 'Things I'm Proud Of' wall is hers."
        />
      </div>

      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 p-3 text-sm">
        <span className="font-semibold">Goal for 6th grade:</span> re-enter at or above grade level so the IEP becomes
        optional. The parent dashboard tracks her trajectory toward that quietly — Reagan never sees the score, only her
        own progress going up.
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tutors and any adult helping Reagan should read this card before each session. The whole app is built around
        these four ideas.
      </p>
    </Card>
  );
}

function Principle({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
      <div className="flex items-center gap-2 font-display font-semibold">
        <span className="text-xl" aria-hidden>{emoji}</span>
        <span>{title}</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-neutral-700 dark:text-neutral-300">{body}</p>
    </div>
  );
}
