import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Kiwi Coins page (kid view).
 * Replaces the old My Levels + Proud Wall + Rewards/Prizes trio.
 *
 * What Reagan sees here:
 *  1. Big coin balance pill at the top.
 *  2. The ~10 prizes Mom set up, each with a one-tap "Get this" button.
 *  3. A short list of how to earn more coins.
 *
 * Design constraints (locked May 4 2026):
 *  - Plain language, no jargon, big tap targets, one obvious action per row.
 *  - No leveling, no progress bars beyond the affordable/unaffordable hint.
 *  - Reagan can REQUEST a prize; redemption is approved by an adult.
 */
export default function KiwiCoins() {
  // Coin balance — falls back gracefully if the procedure isn't ready yet.
  const balanceQ = (trpc as any).coins?.balance?.useQuery
    ? (trpc as any).coins.balance.useQuery()
    : { data: { balance: 0 }, isLoading: false };

  // Prizes shop — falls back to an empty list so the page still renders.
  const prizesQ = (trpc as any).prizes?.list?.useQuery
    ? (trpc as any).prizes.list.useQuery()
    : { data: [], isLoading: false };

  const balance: number = balanceQ.data?.balance ?? 0;
  const prizes: Array<{
    id: number | string;
    title: string;
    coinCost: number;
    description?: string | null;
    imageUrl?: string | null;
  }> = prizesQ.data ?? [];

  const requestPrize = (title: string) =>
    toast.success(`Asked for "${title}"!`, {
      description: "An adult will tap yes or no soon.",
    });

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Coin balance */}
      <Card className="border-2 border-yellow-400 bg-yellow-50/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl flex items-center gap-3">
            <span className="text-4xl">🪙</span>
            <span>My Kiwi Coins</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-6xl font-display text-yellow-900">
            {balance}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Earn coins by finishing your school work and helping out.
          </p>
        </CardContent>
      </Card>

      {/* Prize shop */}
      <div>
        <h2 className="text-xl font-display mb-3 flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          <span>Prize Shop</span>
        </h2>

        {prizesQ.isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Loading prizes…</CardContent></Card>
        ) : prizes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No prizes yet. Mom will add some soon!
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {prizes.slice(0, 10).map((p) => {
              const canAfford = balance >= p.coinCost;
              return (
                <Card key={p.id} className={canAfford ? "border-green-400" : ""}>
                  <CardContent className="p-4 flex gap-3 items-center">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl">
                        🎁
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      {p.description ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {p.description}
                        </div>
                      ) : null}
                      <Badge variant="secondary" className="mt-1">
                        🪙 {p.coinCost}
                      </Badge>
                    </div>
                    <Button
                      size="lg"
                      disabled={!canAfford}
                      onClick={() => requestPrize(p.title)}
                    >
                      {canAfford ? "Get this" : "Save up"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* How to earn */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How to earn coins</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>• Finish a school task — get coins</div>
          <div>• Help with a chore — get coins</div>
          <div>• Read on your own — get coins</div>
          <div>• Try something new — get coins</div>
        </CardContent>
      </Card>
    </div>
  );
}
