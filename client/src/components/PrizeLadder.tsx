import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PrizeLadder — shows Reagan how close she is to each active prize.
 * Orders prizes by coinCost ascending, draws a horizontal ladder with
 * a glowing marker at her current coin balance, and a small progress
 * bar / coins-to-go label under each prize.
 */
export default function PrizeLadder() {
  const coins = trpc.rewards.myCoins.useQuery();
  const prizesQ = trpc.rewards.listPrizes.useQuery({ activeOnly: true });

  const balance = coins.data?.balance ?? 0;

  const sorted = useMemo(() => {
    const all: any[] = prizesQ.data ?? [];
    return [...all].sort((a, b) => a.coinCost - b.coinCost);
  }, [prizesQ.data]);

  if (prizesQ.isLoading || coins.isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Prize Ladder</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!sorted.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Prize Ladder</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No active prizes yet. Ask an adult to add some in Settings → Rewards.
        </CardContent>
      </Card>
    );
  }

  const maxCost = sorted[sorted.length - 1].coinCost || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Prize Ladder</span>
          <span className="text-sm font-semibold text-amber-500">
            {balance} <span className="opacity-70">coins</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Track with a marker */}
        <div className="relative h-10 rounded-full bg-gradient-to-r from-amber-100 via-amber-200 to-amber-300 dark:from-amber-900/30 dark:via-amber-800/30 dark:to-amber-700/30 overflow-visible">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-amber-500/60"
            style={{ width: `${Math.min(100, (balance / maxCost) * 100)}%` }}
            aria-label="Coins earned so far"
          />
          <div
            className="absolute -top-1 bottom-[-4px] w-1 bg-amber-600 rounded-full shadow-lg"
            style={{ left: `calc(${Math.min(100, (balance / maxCost) * 100)}% - 2px)` }}
            aria-hidden="true"
          />
        </div>

        {/* Prize pins along the ladder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sorted.map((p) => {
            const affordable = balance >= p.coinCost;
            const remaining = Math.max(0, p.coinCost - balance);
            const pct = Math.max(0, Math.min(100, (balance / p.coinCost) * 100));
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border p-2 ${
                  affordable
                    ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20"
                    : "border-border bg-card"
                }`}
                title={p.description || p.title}
              >
                <div className="text-2xl" aria-hidden="true">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${affordable ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs tabular-nums whitespace-nowrap">
                  {affordable ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready!</span>
                  ) : (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{remaining}</span> to go
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Finish schedule blocks to earn coins. Adults can give bonus stickers in Settings.
        </p>
      </CardContent>
    </Card>
  );
}
