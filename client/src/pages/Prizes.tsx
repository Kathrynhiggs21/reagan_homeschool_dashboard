import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

/**
 * Prize Shop — spend coins on prizes Mom has approved.
 * Each prize shows a progress bar toward its coinCost; if the balance is enough,
 * the Redeem button is enabled. Redemption goes into a "pending" queue for
 * Mom to approve in a future adult view.
 */

const CATEGORY_COLORS: Record<string, { bg: string; ink: string; border: string }> = {
  digital:     { bg: "#c9a7ff", ink: "#2a0e66", border: "#7c3aed" },
  cash:        { bg: "#7fe3c4", ink: "#063c2d", border: "#10b981" },
  treat:       { bg: "#ff8fa3", ink: "#5a0724", border: "#e11d6b" },
  toy:         { bg: "#ffb07a", ink: "#4a1a00", border: "#ff6a00" },
  experience:  { bg: "#7ec8ff", ink: "#062a5c", border: "#1d6fe0" },
  screen_time: { bg: "#ffe066", ink: "#4a3600", border: "#d4a900" },
  custom:      { bg: "#ffaad4", ink: "#500724", border: "#db2777" },
};

export default function Prizes() {
  const prizes = trpc.rewards.listPrizes.useQuery();
  const coins = trpc.rewards.myCoins.useQuery();
  const myReds = trpc.rewards.myRedemptions.useQuery();
  const seedM = trpc.rewards.seedPrizes.useMutation();
  const requestM = trpc.rewards.requestPrize.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Requested: ${r.title}! Mom will approve soon.`);
      coins.refetch();
      myReds.refetch();
      prizes.refetch();
    },
    onError: (e) => toast.error(e.message || "Couldn't request this prize."),
  });

  const balance = coins.data?.balance ?? 0;
  const list = Array.isArray(prizes.data) ? prizes.data : [];

  // Auto-seed default prizes on first visit if the table is empty
  useEffect(() => {
    if (!prizes.isLoading && list.length === 0 && !seedM.isPending && !seedM.isSuccess) {
      seedM.mutate(undefined, { onSuccess: () => prizes.refetch() });
    }
  }, [prizes.isLoading, list.length, seedM.isPending, seedM.isSuccess]);

  const pending = Array.isArray(myReds.data) ? myReds.data.filter((r: any) => r.status === "pending") : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <header
        className="rounded-2xl p-6 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #7fe3c4 0%, #7ec8ff 60%, #c9a7ff 100%)",
          border: "3px solid #ffffff",
          color: "#063c2d",
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-70">Reagan's</div>
            <h1 className="font-display text-4xl md:text-5xl leading-tight">Prize Shop 🪙</h1>
            <p className="mt-2 text-sm opacity-90">Save up your coins — Mom approves every prize.</p>
          </div>
          <div className="rounded-full bg-white/85 px-5 py-3 text-xl font-display font-bold">
            🪙 {balance} <span className="text-sm opacity-70 font-normal">coins</span>
          </div>
        </div>
      </header>

      {/* Pending redemptions */}
      {pending.length > 0 && (
        <Card className="classroom-card p-4">
          <div className="font-display font-semibold text-base mb-2">Waiting for Mom's approval…</div>
          <div className="space-y-1.5">
            {pending.map((r: any) => (
              <div key={r.id} className="text-sm flex items-center justify-between">
                <span>#{r.id} · {r.coinCost} 🪙</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">pending</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Prize grid */}
      {prizes.isLoading && <div className="text-muted-foreground text-sm">Loading prizes…</div>}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((p: any) => {
          const cc = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.custom;
          const canAfford = balance >= p.coinCost;
          const pct = Math.min(100, Math.round((balance / Math.max(1, p.coinCost)) * 100));
          return (
            <div
              key={p.id}
              className="rounded-2xl p-5 flex flex-col"
              style={{
                background: cc.bg,
                color: cc.ink,
                border: `3px solid #fff`,
                boxShadow: `0 4px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)`,
                borderLeft: `10px solid ${cc.border}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-4xl">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-lg leading-tight">{p.title}</div>
                  {p.description && <p className="text-sm opacity-90 mt-1 leading-snug">{p.description}</p>}
                </div>
              </div>

              {/* Cost + progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>🪙 {p.coinCost} coins</span>
                  <span className="opacity-80 text-xs">{Math.min(balance, p.coinCost)} / {p.coinCost}</span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-full bg-white/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: cc.border }}
                  />
                </div>
              </div>

              <Button
                disabled={!canAfford || requestM.isPending}
                onClick={() => requestM.mutate({ prizeId: p.id })}
                className="mt-4 w-full font-bold rounded-full"
                style={{
                  background: canAfford ? cc.border : "#e5e7eb",
                  color: canAfford ? "#fff" : "#6b7280",
                  opacity: canAfford ? 1 : 0.7,
                }}
              >
                {canAfford ? "Redeem 🎁" : `Need ${p.coinCost - balance} more coins`}
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
