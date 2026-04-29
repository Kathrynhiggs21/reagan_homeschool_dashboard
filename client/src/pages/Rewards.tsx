import { useState } from "react";
import Stickers from "./Stickers";
import Prizes from "./Prizes";

/**
 * Rewards — tabbed page combining Sticker Book + Prize Shop.
 * One sidebar entry, calmer header, quick tab switcher.
 */
export default function Rewards() {
  const [tab, setTab] = useState<"stickers" | "prizes">("stickers");

  return (
    <div className="space-y-4">
      {/* Calm chalk header (no ombre gradient) */}
      <header
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,216,106,0.25)",
        }}
      >
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#ffd97a", opacity: 0.85 }}>Reagan's</div>
          <h1 className="font-display text-2xl md:text-3xl leading-tight chalk-white">Rewards</h1>
        </div>
        <div className="flex gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={{
              background: tab === "stickers" ? "rgba(255,216,106,0.25)" : "transparent",
              color: tab === "stickers" ? "#ffd97a" : "rgba(255,255,255,0.7)",
            }}
            onClick={() => setTab("stickers")}
          >
            ⭐ Stickers
          </button>
          <button
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={{
              background: tab === "prizes" ? "rgba(127,227,196,0.25)" : "transparent",
              color: tab === "prizes" ? "#7fe3c4" : "rgba(255,255,255,0.7)",
            }}
            onClick={() => setTab("prizes")}
          >
            🪙 Prizes
          </button>
        </div>
      </header>

      {tab === "stickers" ? <Stickers /> : <Prizes />}
    </div>
  );
}
