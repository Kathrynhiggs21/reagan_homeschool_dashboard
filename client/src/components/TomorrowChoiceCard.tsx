/**
 * Push 82 (2026-05-13) — Tomorrow's summer-choice 3-option chooser
 * (kid-side, lives on Today).
 *
 * Self-hides when summer mode is not active OR when the deterministic
 * option set is empty. Shows three calm cards Reagan can tap to pick
 * tomorrow's choice block. Because every option in the set is
 * pre-approved by the curriculum + summer variant registry, picking
 * one auto-approves (no SMS to Mom/Grandma per the never-queued rule).
 *
 * After Reagan picks, the card collapses into a small confirmation pill
 * so it doesn't keep nagging her.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TomorrowChoiceCard() {
  const utils = trpc.useUtils();
  const q = (trpc as any).today?.tomorrowChoice?.useQuery?.({ blockType: "choice" });
  const m = (trpc as any).today?.recordTomorrowChoice?.useMutation?.({
    onSuccess: () => {
      try {
        utils.today?.tomorrowChoice?.invalidate?.();
      } catch {
        /* tRPC utils not available in test renderer */
      }
    },
  });
  const [picked, setPicked] = useState<string | null>(null);

  if (!q || q.isLoading) return null;
  const data = q.data;
  if (!data) return null;
  if (!data.active) return null;
  const options = data.options as Array<{ kind: string; title: string; blurb: string; chip: string }>;
  if (!options || options.length === 0) return null;

  const currentPick = picked ?? data.chosenKind ?? null;
  if (currentPick) {
    const chosen = options.find((o) => o.kind === currentPick);
    return (
      <Card data-tomorrow-choice data-state="picked" className="rounded-2xl border-emerald-200 bg-emerald-50/70 shadow-sm">
        <CardContent className="flex items-center gap-2 py-3 px-4">
          <span className="text-lg">✅</span>
          <span className="text-sm text-emerald-800">
            Tomorrow's pick: <strong>{chosen?.chip ?? currentPick}</strong>
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-tomorrow-choice data-state="choosing" className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700">
          ☀️ Pick tomorrow's choice block
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-slate-500 mb-3">
          Tap one — it's locked in instantly. (You can switch any time before bed.)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {options.map((opt) => {
            const isBusy = m?.isPending && m?.variables?.chosenKind === opt.kind;
            return (
              <button
                key={opt.kind}
                disabled={isBusy}
                data-choice-button={opt.kind}
                onClick={() => {
                  setPicked(opt.kind);
                  try {
                    m?.mutate?.({ chosenKind: opt.kind, blockType: "choice" });
                  } catch {
                    // Roll back optimistic pick on error
                    setPicked(null);
                  }
                }}
                className="flex flex-col items-start gap-1 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 px-3 py-2 text-left transition-colors disabled:opacity-60"
              >
                <span className="text-base font-semibold text-amber-900">{opt.chip}</span>
                <span className="text-sm font-medium text-slate-800">{opt.title}</span>
                <span className="text-xs text-slate-600">{opt.blurb}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
