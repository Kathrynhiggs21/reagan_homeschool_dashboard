/**
 * Push 119 (2026-05-13) — Slay Charge ⚡ render card for Today.
 *
 * Inline card that renders only inside the morning-vibe block (so it
 * lives where Reagan's eyes are already going at the top of Today).
 *
 * Behavior:
 *   - Fetches today's pick via trpc.today.slayCharge (joke OR clip).
 *   - Shows the joke text (or clip title + Watch link).
 *   - "🔄 give me another" button bumps rerollIndex, re-queries.
 *   - No submission row is ever created — this is a mood-setter, not
 *     schoolwork. Mom-side Analytics will never see anything from here.
 *
 * The component itself self-hides when the procedure returns a non-OK
 * pick (e.g., bad date) — no info means no render, consistent with the
 * dashboard's empty-state rule.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface SlayChargeCardProps {
  dateIso: string;
}

export function SlayChargeCard({ dateIso }: SlayChargeCardProps) {
  const [rerollIndex, setRerollIndex] = useState(0);
  const query = trpc.today.slayCharge.useQuery({ dateIso, rerollIndex });

  if (query.isLoading) {
    return (
      <div
        className="rounded-lg border border-amber-300/40 bg-amber-200/10 px-3 py-2 text-xs text-amber-50"
        data-testid="slay-charge-card-loading"
      >
        Slay Charge ⚡ loading…
      </div>
    );
  }

  const pick = (query.data as any)?.pick;
  if (!pick || pick.ok !== true) return null; // self-hide on bad data

  const item = pick.item;
  const isClip = item.kind === "clip";

  return (
    <div
      className="rounded-lg border border-amber-300/40 bg-amber-300/15 px-3 py-2.5 mt-1"
      data-testid="slay-charge-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-amber-200/90 mb-0.5">
            {isClip ? "today's clip" : "today's joke"}
          </div>
          <div className="text-sm font-semibold text-amber-50 leading-snug">
            {item.text}
          </div>
          {isClip && item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-1 text-xs underline text-amber-200 hover:text-amber-100"
              data-testid="slay-charge-clip-link"
            >
              ▶ Watch (opens in new tab)
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRerollIndex((n) => n + 1)}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-300/30 border border-amber-300/50 px-2 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-300/45"
          title="Give me another one"
          aria-label="Give me another Slay Charge pick"
          data-testid="slay-charge-reroll"
        >
          🔄 give me another
        </button>
      </div>
    </div>
  );
}
