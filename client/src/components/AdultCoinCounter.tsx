/**
 * AdultCoinCounter — large 3D glossy Kiwi-coin counter, only shown on adult-gated pages.
 * Pulls live balance from rewards.myCoins. Decorative gold-disc with a kiwi feather inside.
 */
import { trpc } from "@/lib/trpc";

export default function AdultCoinCounter({
  className = "",
  label = "Reagan's Kiwi Coins",
}: {
  className?: string;
  label?: string;
}) {
  const { data, isLoading } = trpc.rewards.myCoins.useQuery();
  const balance = (data as any)?.balance ?? (typeof data === "number" ? (data as number) : 0);

  return (
    <div
      className={`relative inline-flex items-center gap-4 rounded-3xl px-5 py-3 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,236,170,0.95) 0%, rgba(255,206,99,0.95) 60%, rgba(220,160,40,0.95) 100%)",
        boxShadow:
          "0 14px 28px -10px rgba(120,80,15,0.45), inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -3px 0 rgba(120,80,15,0.18)",
        border: "1px solid rgba(255,255,255,0.5)",
      }}
      role="status"
      aria-label={`${label}: ${balance}`}
      data-testid="adult-coin-counter"
    >
      {/* glossy gold disc */}
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #fff5c2 0%, #ffd24d 35%, #d8961c 80%, #8a5a09 100%)",
          boxShadow:
            "inset 0 3px 6px rgba(255,255,255,0.85), inset 0 -4px 8px rgba(120,60,0,0.55), 0 4px 10px rgba(0,0,0,0.25)",
        }}
        aria-hidden
      >
        <span className="drop-shadow-sm" style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.6))" }}>
          🥝
        </span>
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse 60% 30% at 35% 25%, rgba(255,255,255,0.85) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
          aria-hidden
        />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-900/70">
          {label}
        </span>
        <span className="text-3xl font-extrabold text-amber-900 tabular-nums">
          {isLoading ? "…" : balance.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
