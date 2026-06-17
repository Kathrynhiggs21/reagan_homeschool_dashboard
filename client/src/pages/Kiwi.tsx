/**
 * Coins page (/kiwi, /coins) — rebuilt 2026-06-17 per Katy's spec.
 *
 * What this page IS now:
 *   • Big totals header: today / this week / total earned, plus the current
 *     balance, in a friendly, high-contrast, no-grey layout.
 *   • A "spent so far" (used) row.
 *   • ONE button: "Email Mom to exchange coins" → spear.cpt@gmail.com only
 *     (NOT Grandma, per Katy).
 *   • An expandable ledger table (date · what · coins) so Reagan and adults
 *     can see exactly how every coin was earned or used.
 *   • When the Adult area is unlocked, a small adult-only panel lets Mom or
 *     Grandma mark N coins redeemed for a free-text reward — this writes a
 *     real ledger entry so the totals stay honest.
 *
 * What was REMOVED (per Katy):
 *   • The practice-activity browser (icon/list/column views).
 *   • The Kiwi voice sliders.
 *   • The prize store / prize ladder.
 *
 * Coins are now auto-awarded by difficulty + time when Reagan finishes a
 * block, assignment, questionnaire, or printable — there is nothing for her
 * to "buy" here, only to see and (with an adult) exchange.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Mail, Coins as CoinsIcon } from "lucide-react";
import { useAdultLock } from "@/contexts/AdultLockContext";

// Friendly label for each ledger entry kind.
function kindLabel(kind: string, reasonNote: string | null): string {
  if (reasonNote && reasonNote.trim().length > 0) {
    // reasonNote is the most specific — surface it directly when present.
    if (reasonNote.startsWith("Redeemed:")) return reasonNote.replace(/^Redeemed:\s*/, "Used for ");
    if (reasonNote.startsWith("Printable:")) return reasonNote.replace(/^Printable:\s*/, "Worksheet: ");
    if (reasonNote.startsWith("Requested:")) return reasonNote.replace(/^Requested:\s*/, "Asked for ");
    if (reasonNote === "block_done") return "Finished a school block";
    if (reasonNote === "adult_bonus") return "Bonus from a grown-up";
    if (reasonNote === "streak_bonus") return "Streak bonus";
    if (reasonNote === "gold_star_day") return "Gold-star day";
    if (reasonNote === "submission_approved") return "Work approved";
    if (reasonNote === "placement_complete") return "Finished a check-in";
    return reasonNote;
  }
  switch (kind) {
    case "earn_sticker": return "Earned a sticker";
    case "earn_bonus": return "Bonus coins";
    case "earn_gold_star": return "Gold-star reward";
    case "spend_prize": return "Used coins";
    case "adjust": return "Adjustment";
    default: return "Coins";
  }
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Kiwi() {
  const utils = trpc.useUtils();
  const { unlocked } = useAdultLock();

  const summaryQ = trpc.rewards.coinSummary.useQuery();
  const ledgerQ = trpc.rewards.myLedger.useQuery({ limit: 100 });

  const s = (summaryQ.data as any) ?? { today: 0, week: 0, totalEarned: 0, used: 0, balance: 0 };
  const ledger: any[] = (ledgerQ.data as any[]) ?? [];

  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Adult redeem panel state.
  const [redeemCoins, setRedeemCoins] = useState<string>("");
  const [redeemReward, setRedeemReward] = useState<string>("");
  const redeem = trpc.rewards.redeemCoins.useMutation({
    onSuccess: (res: any) => {
      toast.success(`Redeemed ${res.redeemed} coins`, { description: `For: ${res.reward}` });
      setRedeemCoins("");
      setRedeemReward("");
      utils.rewards.coinSummary.invalidate();
      utils.rewards.myLedger.invalidate();
      utils.rewards.myCoins.invalidate();
    },
    onError: (err) => toast.error("Couldn't redeem", { description: err.message }),
  });

  // Email Mom (spear.cpt@gmail.com ONLY — not Grandma).
  const redeemUrl = useMemo(() => {
    const subject = encodeURIComponent("Reagan wants to use her Kiwi Coins!");
    const body = encodeURIComponent(
      `Hi Mom,\n\n` +
      `I have ${s.balance} Kiwi Coins right now and I'd like to exchange some.\n` +
      `Can we pick something fun together?\n\n` +
      `Love,\nReagan`,
    );
    return `mailto:spear.cpt@gmail.com?subject=${subject}&body=${body}`;
  }, [s.balance]);

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      {/* ── TOTALS HEADER ──────────────────────────────────────────────── */}
      <header className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="text-6xl" aria-hidden>🪙</span>
          <div>
            <div className="text-5xl font-bold leading-none text-yellow-700 dark:text-yellow-300">
              {s.balance}
            </div>
            <div className="text-base font-medium text-yellow-900/80 dark:text-yellow-200/80 mt-1">
              Kiwi Coins to spend
            </div>
          </div>
        </div>

        {/* today / week / total earned tiles */}
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Today" value={s.today} accent="text-emerald-700 dark:text-emerald-300" />
          <Tile label="This week" value={s.week} accent="text-sky-700 dark:text-sky-300" />
          <Tile label="Earned all-time" value={s.totalEarned} accent="text-violet-700 dark:text-violet-300" />
        </div>

        {/* used row */}
        <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/30 px-5 py-3">
          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Coins used so far
          </span>
          <span className="text-xl font-bold text-amber-800 dark:text-amber-200">{s.used}</span>
        </div>

        {/* Email Mom button */}
        <a href={redeemUrl} className="block">
          <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-600 text-amber-50 shadow-md">
            <Mail className="w-5 h-5 mr-2" />
            Email Mom to exchange coins
          </Button>
        </a>
      </header>

      {/* ── EXPANDABLE LEDGER ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setLedgerOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30 transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold text-yellow-900 dark:text-yellow-100">
            <CoinsIcon className="w-5 h-5" />
            My coin history
          </span>
          {ledgerOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {ledgerOpen && (
          <div className="divide-y divide-border">
            {ledgerQ.isLoading && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!ledgerQ.isLoading && ledger.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                No coins yet — finish a school block to start earning!
              </div>
            )}
            {ledger.map((row) => {
              const delta = Number(row.delta) || 0;
              const positive = delta > 0;
              return (
                <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{kindLabel(row.kind, row.reasonNote)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(row.createdAt)}</div>
                  </div>
                  <div className={`text-sm font-bold shrink-0 ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {positive ? "+" : ""}{delta}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── ADULT REDEEM PANEL (only when Adult area unlocked) ─────────── */}
      {unlocked && (
        <section className="rounded-xl border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Grown-up: mark coins redeemed
          </h2>
          <p className="text-xs text-muted-foreground">
            When Reagan trades coins for a reward, record it here so her balance stays accurate.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="number"
              min={1}
              placeholder="Coins"
              value={redeemCoins}
              onChange={(e) => setRedeemCoins(e.target.value)}
              className="sm:w-28"
            />
            <Input
              placeholder="Reward (e.g. movie night)"
              value={redeemReward}
              onChange={(e) => setRedeemReward(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                const n = parseInt(redeemCoins, 10);
                if (!Number.isFinite(n) || n < 1) {
                  toast.error("Enter how many coins to redeem");
                  return;
                }
                if (!redeemReward.trim()) {
                  toast.error("Enter what the coins are for");
                  return;
                }
                redeem.mutate({ coins: n, reward: redeemReward.trim() });
              }}
              disabled={redeem.isPending}
            >
              {redeem.isPending ? "Saving…" : "Redeem"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 text-center bg-card">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs font-medium text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
