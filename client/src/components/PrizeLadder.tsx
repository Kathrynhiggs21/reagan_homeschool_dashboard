import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * PrizeLadder — redesigned Apr 30.
 *
 * Shows Reagan each active prize as a rung on a wooden ladder, numbered
 * 1..N from bottom to top. Big chunky rung numbers so she can say
 * "I'm on rung 2, I want to get to rung 5." Prize currency is now
 * labeled "Feathers" 🪶 (backend field `coinCost` unchanged).
 *
 * Design notes:
 *   - Storybook parchment card, wooden side-rails, rope-stitched rungs.
 *   - A glowing feather marker slides up the rail to show current balance.
 *   - Each rung row shows: rung number, emoji, prize name, Feathers cost,
 *     and a progress pill ("Ready!" / "N to go").
 *   - No ombre gradient. Tan + mint + warm amber palette.
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
      <LadderShell title="Prize Ladder">
        <div className="text-sm opacity-70 px-2 py-3">Loading…</div>
      </LadderShell>
    );
  }

  if (!sorted.length) {
    return (
      <LadderShell title="Prize Ladder">
        <div className="text-sm opacity-80 px-3 py-4">
          No prizes yet. Ask an adult to add some in <strong>Settings → Rewards</strong>.
        </div>
      </LadderShell>
    );
  }

  const maxCost = sorted[sorted.length - 1].coinCost || 1;
  const balancePct = Math.min(100, (balance / maxCost) * 100);

  return (
    <LadderShell
      title="Prize Ladder"
      badge={
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold"
          style={{
            background: "#fffdf7",
            border: "3px solid #7fe3c4",
            boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
            color: "#0b4a38",
          }}
          title="Feathers — Kiwi's reward currency"
        >
          <span aria-hidden>🪶</span>
          <span className="tabular-nums">{balance}</span>
          <span className="opacity-70 font-semibold">Feathers</span>
        </span>
      }
    >
      <div className="relative pl-6 pr-2 pb-4">
        {/* Left wooden rail with feather marker sliding up the rail */}
        <div
          className="absolute left-2 top-2 bottom-2 w-3 rounded-full"
          style={{
            background:
              "linear-gradient(180deg, #c98447 0%, #a4622e 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25), 0 2px 0 rgba(0,0,0,0.12)",
          }}
          aria-hidden
        />
        <div
          className="absolute left-[-2px] text-xl transition-all"
          style={{
            bottom: `calc(${balancePct}% + 4px)`,
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
          }}
          aria-label={`You have ${balance} Feathers`}
          title={`You have ${balance} Feathers`}
        >
          🪶
        </div>

        {/* Rungs, bottom-to-top visually, so reverse sorted for render */}
        <ol className="flex flex-col-reverse gap-2">
          {sorted.map((p, idx) => {
            const rung = idx + 1; // rung 1 is cheapest
            const affordable = balance >= p.coinCost;
            const remaining = Math.max(0, p.coinCost - balance);
            const pct = Math.max(0, Math.min(100, (balance / p.coinCost) * 100));
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2"
                style={{
                  background: affordable ? "rgba(127,227,196,0.18)" : "rgba(255,253,247,0.9)",
                  border: `3px solid ${affordable ? "#34d399" : "#e7d6a6"}`,
                  boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
                }}
                title={p.description || p.title}
              >
                {/* Chunky rung number */}
                <div
                  className="shrink-0 flex items-center justify-center rounded-full font-black"
                  style={{
                    width: 44,
                    height: 44,
                    fontSize: 22,
                    background: affordable ? "#34d399" : "#ffd97a",
                    color: "#2a1a00",
                    border: "3px solid #ffffff",
                    boxShadow: "0 3px 0 rgba(0,0,0,0.18)",
                    fontFamily: "'Patrick Hand','Comic Sans MS',cursive",
                  }}
                  aria-label={`Rung ${rung}`}
                >
                  {rung}
                </div>
                <div className="text-2xl shrink-0" aria-hidden>{p.emoji || "🎁"}</div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-extrabold truncate"
                    style={{ color: "#3b2a00" }}
                  >
                    {p.title}
                  </div>
                  <div
                    className="text-[12px] font-semibold flex items-center gap-2 mt-0.5"
                    style={{ color: "#6b4a00" }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden>🪶</span>
                      <span className="tabular-nums">{p.coinCost}</span>
                      <span className="opacity-70">Feathers</span>
                    </span>
                    <span
                      className="h-1.5 flex-1 rounded-full overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.08)" }}
                      aria-hidden
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${pct}%`,
                          background: affordable ? "#34d399" : "#ffb84d",
                        }}
                      />
                    </span>
                  </div>
                </div>
                <div
                  className="text-[12px] tabular-nums whitespace-nowrap font-extrabold"
                  style={{ color: affordable ? "#0b4a38" : "#6b4a00" }}
                >
                  {affordable ? (
                    <span>✨ Ready!</span>
                  ) : (
                    <span>
                      <span className="text-base">{remaining}</span>{" "}
                      <span className="opacity-70 font-semibold">to go</span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-3 text-[11px] leading-snug px-1" style={{ color: "#5a4000" }}>
          Finish schedule blocks to earn <strong>Feathers</strong> 🪶. Adults can give bonus
          stickers in Settings.
        </p>
      </div>
    </LadderShell>
  );
}

/** Reusable parchment card shell for the ladder (no ui/card import). */
function LadderShell({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[20px] shadow-[0_6px_0_rgba(0,0,0,0.1),0_20px_40px_-24px_rgba(0,0,0,0.4)] overflow-hidden"
      style={{
        background:
          "repeating-linear-gradient(135deg, #fff8e6 0 24px, #fff3d4 24px 48px)",
        border: "4px solid #ffffff",
        color: "#3b2a00",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "2px dashed #e7d6a6" }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🪜</span>
          <h2
            className="text-lg md:text-xl font-extrabold"
            style={{ fontFamily: "'Patrick Hand','Comic Sans MS',cursive", color: "#4a3600" }}
          >
            {title}
          </h2>
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  );
}
