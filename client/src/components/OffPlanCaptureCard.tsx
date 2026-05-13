/**
 * Push 84 (2026-05-13) — Adult-only "Off-plan capture today" card.
 *
 * Surfaces:
 *   - count of today's off-plan actuals (topics captured outside the plan)
 *   - how many have been pushed to Drive vs still pending
 *   - per-row preview with subject + topic + push-status pill
 *
 * Self-hides when totalCount === 0 (no-info rule). Self-hides when the
 * caller is Reagan (server returns allowed:false → empty payload).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export function OffPlanCaptureCard() {
  // Stabilize the optional input shape so the query doesn't re-fetch.
  const input = useMemo(() => ({ date: undefined as string | undefined }), []);
  const { data, isLoading } = trpc.today.offPlanCaptureSummary.useQuery(input);

  if (isLoading) return null;
  if (!data || !data.allowed) return null;
  if (data.totalCount === 0) return null;

  const { totalCount, drivePushedCount, pendingCount, items, date } = data;

  return (
    <div
      data-testid="off-plan-capture-card"
      className="rounded-2xl border border-amber-300/50 bg-amber-50/80 px-4 py-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-amber-900">
            Off-plan captures today
          </div>
          <div className="text-xs text-amber-800/80">
            {date} · {totalCount} topic{totalCount === 1 ? "" : "s"} captured
            outside the planned curriculum
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            data-testid="off-plan-drive-pushed-count"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
          >
            ✓ {drivePushedCount} in Drive
          </span>
          {pendingCount > 0 && (
            <span
              data-testid="off-plan-pending-count"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
            >
              ⏳ {pendingCount} pending
            </span>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900">
          {items.slice(0, 6).map((it) => (
            <li key={it.id} className="flex items-center gap-2">
              <span className="font-medium uppercase tracking-wide text-amber-700">
                {it.subjectSlug}
              </span>
              <span className="text-amber-900/90">{it.topic}</span>
              {it.drivePushed ? (
                <span className="ml-auto text-emerald-700">✓ Drive</span>
              ) : (
                <span className="ml-auto text-amber-700">⏳</span>
              )}
            </li>
          ))}
          {items.length > 6 && (
            <li className="italic text-amber-700/80">
              …and {items.length - 6} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
