import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMemo, useState } from "react";

/**
 * Prize Shop — Reagan view.
 * - Kiwi Coins balance + nearest-prize progress bar at the top
 * - Image-first tiles (image + title + cost). Tap → popup with description + Redeem.
 * - Per spec: prizes start EMPTY; adults populate via Settings → Rewards Manager.
 */

const CATEGORY_TINT: Record<string, string> = {
  digital: "from-purple-100 to-fuchsia-100",
  cash: "from-emerald-100 to-teal-100",
  treat: "from-pink-100 to-rose-100",
  toy: "from-amber-100 to-orange-100",
  experience: "from-sky-100 to-blue-100",
  screen_time: "from-yellow-100 to-amber-100",
  custom: "from-rose-100 to-pink-100",
};

function parseDescAndImg(raw: string | null | undefined): { description: string | null; imageUrl: string | null } {
  if (!raw) return { description: null, imageUrl: null };
  // Adult Manager stores `{"img":"...","text":"..."}` JSON when an image is provided.
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw);
      return { description: o.text ?? null, imageUrl: o.img ?? null };
    } catch { /* fall through */ }
  }
  return { description: raw, imageUrl: null };
}

export default function Prizes() {
  const prizes = trpc.rewards.listPrizes.useQuery();
  const coins = trpc.rewards.myCoins.useQuery();
  const myReds = trpc.rewards.myRedemptions.useQuery();
  const requestM = trpc.rewards.requestPrize.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Requested: ${r.title}! Mom will approve soon.`);
      coins.refetch();
      myReds.refetch();
      prizes.refetch();
      setOpen(null);
    },
    onError: (e) => toast.error(e.message || "Couldn't request this prize."),
  });

  const balance = coins.data?.balance ?? 0;
  const list = Array.isArray(prizes.data) ? prizes.data : [];
  const pending = Array.isArray(myReds.data) ? myReds.data.filter((r: any) => r.status === "pending") : [];
  const [open, setOpen] = useState<any | null>(null);

  // Find nearest prize to drive the top progress bar
  const nearest = useMemo(() => {
    if (!list.length) return null;
    const above = list.filter((p: any) => p.coinCost > balance).sort((a: any, b: any) => a.coinCost - b.coinCost);
    return above[0] ?? list[0];
  }, [list, balance]);

  const openInfo = open ? parseDescAndImg(open.description) : { description: null, imageUrl: null };

  return (
    <div className="space-y-5">
      {/* Hero with Kiwi Coins balance + nearest-prize progress */}
      <Card className="rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-amber-50 via-pink-50 to-sky-50 border-0 shadow">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-800/80">Reagan's</div>
            <h1 className="font-display text-3xl sm:text-4xl text-amber-900">Prize Shop</h1>
            <p className="text-sm text-amber-900/80 mt-1">Save your Kiwi Coins. Tap a prize to learn more.</p>
          </div>
          <div className="rounded-full bg-white/85 px-5 py-3 text-2xl font-display font-extrabold text-amber-900 shadow-sm">
            🪙 {balance}
            <span className="text-xs ml-1 font-normal opacity-70">Kiwi Coins</span>
          </div>
        </div>

        {nearest && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-900/80 mb-1">
              <span>Next prize: {nearest.emoji} {nearest.title}</span>
              <span>{Math.min(balance, nearest.coinCost)} / {nearest.coinCost} 🪙</span>
            </div>
            <div className="h-3 w-full rounded-full bg-white/60 overflow-hidden border border-amber-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-all"
                style={{ width: `${Math.min(100, Math.round((balance / Math.max(1, nearest.coinCost)) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {pending.length > 0 && (
        <Card className="p-3 rounded-2xl bg-amber-50 border-amber-200">
          <div className="text-sm font-semibold text-amber-900 mb-1">Waiting for Mom's approval…</div>
          <div className="flex flex-wrap gap-2">
            {pending.map((r: any) => (
              <span key={r.id} className="text-xs px-2 py-1 rounded-full bg-white border border-amber-200">#{r.id} · {r.coinCost} 🪙</span>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!prizes.isLoading && list.length === 0 && (
        <Card className="p-8 rounded-2xl text-center border-dashed border-2">
          <div className="text-5xl mb-2">🎁</div>
          <div className="font-display text-xl font-bold mb-1">No prizes yet!</div>
          <div className="text-sm opacity-75">Mom is picking out some fun prizes. Check back soon!</div>
        </Card>
      )}

      {/* Image-first tile grid */}
      {prizes.isLoading && <div className="text-sm opacity-70">Loading prizes…</div>}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {list.map((p: any) => {
          const tint = CATEGORY_TINT[p.category] || CATEGORY_TINT.custom;
          const canAfford = balance >= p.coinCost;
          const { imageUrl } = parseDescAndImg(p.description);
          return (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="group text-left rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-lg transition border-2 border-white"
            >
              <div className={`aspect-square bg-gradient-to-br ${tint} flex items-center justify-center overflow-hidden relative`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-7xl drop-shadow-sm">{p.emoji}</div>
                )}
                {canAfford && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">Ready!</div>
                )}
              </div>
              <div className="p-3">
                <div className="font-bold text-sm leading-tight line-clamp-2">{p.title}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-amber-900 font-bold text-sm">🪙 {p.coinCost}</span>
                  <span className="text-[10px] opacity-60">tap to see</span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Detail dialog */}
      {open && (
        <Dialog open onOpenChange={() => setOpen(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">
                <span className="mr-2">{open.emoji}</span>{open.title}
              </DialogTitle>
              <DialogDescription>
                Costs <span className="font-bold text-amber-700">🪙 {open.coinCost} Kiwi Coins</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className={`aspect-video rounded-xl bg-gradient-to-br ${CATEGORY_TINT[open.category] || CATEGORY_TINT.custom} flex items-center justify-center overflow-hidden`}>
                {openInfo.imageUrl ? (
                  <img src={openInfo.imageUrl} alt={open.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-8xl">{open.emoji}</div>
                )}
              </div>
              {openInfo.description && (
                <p className="text-sm leading-relaxed">{openInfo.description}</p>
              )}
              <div className="text-xs opacity-70">
                You have 🪙 {balance} · {balance >= open.coinCost ? "You can redeem this!" : `Need ${open.coinCost - balance} more`}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
              <Button
                disabled={balance < open.coinCost || requestM.isPending}
                onClick={() => requestM.mutate({ prizeId: open.id })}
                className="font-bold"
              >
                {balance >= open.coinCost ? "Redeem 🎁" : `Need ${open.coinCost - balance} more`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
