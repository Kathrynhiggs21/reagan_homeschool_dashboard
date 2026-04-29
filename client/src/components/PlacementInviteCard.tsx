import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

/**
 * PlacementInviteCard — gentle Today-page invite to do (or continue) the
 * diagnostic placement. Disappears once 100% done. No urgency, no scoring.
 */
export default function PlacementInviteCard() {
  const status = trpc.placement.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const data = status.data;
  if (!data) return null;
  if (data.percentOverall >= 100) return null;

  const isFresh = data.percentOverall === 0;

  return (
    <Card className="classroom-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-l-4" style={{ borderLeftColor: "#a78bfa" }}>
      <span className="text-3xl shrink-0" aria-hidden>🌱</span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="font-display text-base">
          {isFresh ? "Want Kiwi to find your starting level?" : "Pick up where you left off"}
        </div>
        <p className="text-xs text-neutral-300">
          {isFresh
            ? "Do a few short \"how does this feel\" questions per subject. There are no scores. You can stop anytime."
            : `${data.percentOverall}% done so far. No rush — come back whenever you feel like it.`}
        </p>
      </div>
      <Link href="/placement" className="shrink-0 px-4 py-2 rounded-md font-semibold text-sm" style={{ background: "#a78bfa", color: "#1a1a1a" }}>
        {isFresh ? "Try it" : "Continue"}
      </Link>
    </Card>
  );
}
