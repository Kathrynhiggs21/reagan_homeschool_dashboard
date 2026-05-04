import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Practice for Coins
 * ───────────────────
 * Reagan can pick a subject → topic → quick drill that auto-opens in a new
 * tab. When she comes back and taps "I finished it!", she earns Kiwi Coins
 * (capped per day, and only outside school hours so it stays a treat).
 */
export default function PracticeForCoins() {
  const utils = trpc.useUtils();
  const lib = trpc.practice.library.useQuery();
  const progress = trpc.practice.todayProgress.useQuery();
  const complete = trpc.practice.complete.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`+${res.coinsAwarded} Kiwi Coins! 🪙`, {
          description: res.capped
            ? `You hit today's cap (${res.cap}). Save the rest for tomorrow!`
            : `Earned ${res.earnedToday}/${res.cap} coins today from extra practice.`,
        });
      } else {
        toast("No coins this time", { description: res.reason });
      }
      utils.practice.todayProgress.invalidate();
      utils.rewards?.myCoins?.invalidate?.();
      utils.rewards?.myLedger?.invalidate?.();
    },
    onError: (err) => toast.error("Couldn't save it", { description: err.message }),
  });

  const [openedSlug, setOpenedSlug] = useState<string | null>(null);

  const groups = lib.data?.groups ?? [];
  const cap = lib.data?.dailyCap ?? 12;
  const inWindow = lib.data?.outsideSchoolHoursNow ?? true;
  const earnedToday = progress.data?.earnedToday ?? 0;
  const remaining = progress.data?.remaining ?? cap;

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">🪙 Practice for Coins</h1>
          <p className="text-muted-foreground mt-1">
            Pick something fun. Finish it. Earn Kiwi Coins.
          </p>
        </div>
        <Card className="min-w-[220px]">
          <CardContent className="py-3 px-4 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Today</span>
              <span className="font-semibold">{earnedToday} / {cap} coins</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all"
                style={{ width: `${Math.min(100, (earnedToday / cap) * 100)}%` }}
              />
            </div>
            {!inWindow && (
              <p className="text-xs text-amber-600 mt-1">
                💛 Practice for Coins opens before 9 AM, after 2 PM, and all weekend.
              </p>
            )}
          </CardContent>
        </Card>
      </header>

      {lib.isLoading && <p className="text-muted-foreground">Loading library…</p>}

      {groups.map((group) => (
        <section key={group.subject} className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">{group.emoji}</span>
            {group.label}
          </h2>
          <div className="space-y-4">
            {group.topics.map((topic) => (
              <Card key={topic.topic}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{topic.topic}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {topic.drills.map((drill) => {
                    const isOpened = openedSlug === drill.slug;
                    return (
                      <div
                        key={drill.slug}
                        className="rounded-lg border p-3 flex flex-col gap-2 bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium leading-snug">{drill.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{drill.blurb}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="secondary" className="text-xs">
                              🪙 {drill.coins}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              ~{drill.minutes} min
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">{drill.provider}</span>
                          <div className="flex gap-2">
                            <a
                              href={drill.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenedSlug(drill.slug)}
                            >
                              <Button size="sm" variant="default">
                                {isOpened ? "Reopen ↗" : "Open ↗"}
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                !inWindow ||
                                remaining <= 0 ||
                                complete.isPending
                              }
                              onClick={() => complete.mutate({ slug: drill.slug })}
                            >
                              I finished it!
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground text-center pt-4">
        Coins from practice are capped at {cap} per day so it stays a treat. Finished drills count
        toward your prize jar in <strong>Kiwi Coins</strong>.
      </p>
    </div>
  );
}
