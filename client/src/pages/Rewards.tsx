import Prizes from "./Prizes";
import PrizeLadder from "@/components/PrizeLadder";
import AdultCoinCounter from "@/components/AdultCoinCounter";

/**
 * Rewards — Reagan side. Stickers UI removed per user request; Kiwi Coins
 * (the points balance + progress to next prize) plus the Prize Shop are the
 * full Reagan-facing reward surface now. Adults still earn coins on her
 * behalf via Settings / Adult Library actions.
 */
export default function Rewards() {
  return (
    <div className="space-y-4">
      <header
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,216,106,0.25)",
        }}
      >
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#ffd97a", opacity: 0.85 }}
          >
            Reagan's
          </div>
          <h1 className="font-display text-2xl md:text-3xl leading-tight chalk-white">
            Rewards
          </h1>
        </div>
        <AdultCoinCounter label="Reagan's Kiwi Coins" />
      </header>

      <PrizeLadder />
      <Prizes />
    </div>
  );
}
