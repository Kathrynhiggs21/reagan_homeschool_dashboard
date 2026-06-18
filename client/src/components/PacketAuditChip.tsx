/**
 * v3.32 (2026-06-04) — Packet-audit status chip.
 *
 * A small, at-a-glance chip for the Today page that tells a grown-up (and
 * reassures Reagan) whether today's packet has real, do-able work in every
 * content block. It reads `nightlyAgenda.packetAuditStatus`, which runs the
 * same audit the nightly assembler uses.
 *
 * Behavior:
 *   - status "ok"      → green "Today's packet: all blocks have work".
 *   - status "gaps"    → amber "N block(s) need content"; when the adult
 *                        panel is unlocked, the offending block titles are
 *                        listed so Mom can patch them quickly.
 *   - status "no_plan" → neutral "No school plan for today" (e.g. weekend).
 *   - status "unknown" / loading → render nothing (no scary states).
 *
 * Kid-safe: never shows answers; on a gap it only ever shows block titles,
 * and only to an unlocked adult.
 */
import { trpc } from "@/lib/trpc";
import { useAdultLock } from "@/contexts/AdultLockContext";

export default function PacketAuditChip({ forDate }: { forDate?: string }) {
  const { unlocked } = useAdultLock();
  const q = trpc.nightlyAgenda.packetAuditStatus.useQuery(
    forDate ? { forDate } : undefined,
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  if (q.isLoading || !q.data) return null;
  const d = q.data;

  // Nothing useful to say for unknown.
  if (d.status === "unknown") return null;

  if (d.status === "no_plan") {
    return (
      <div
        data-packet-audit-chip
        data-status="no_plan"
        className="inline-flex items-center gap-2 rounded-full inner-panel text-muted-foreground px-3 py-1 text-xs font-semibold"
      >
        <span aria-hidden>🗓️</span>
        No school plan for this day
      </div>
    );
  }

  if (d.status === "ok") {
    return (
      <div
        data-packet-audit-chip
        data-status="ok"
        className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold"
        title={`${d.contentBlocks} content block${d.contentBlocks === 1 ? "" : "s"} checked — all have work.`}
      >
        <span aria-hidden>✓</span>
        Today's packet: all blocks have work
      </div>
    );
  }

  // status === "gaps"
  const n = d.emptyCount;
  return (
    <div
      data-packet-audit-chip
      data-status="gaps"
      className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2"
    >
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800">
        <span aria-hidden>⚠️</span>
        {n} block{n === 1 ? "" : "s"} need content
      </div>
      {unlocked && d.emptyBlocks.length > 0 && (
        <ul className="mt-1 ml-5 list-disc text-[11px] text-amber-700">
          {d.emptyBlocks.map((b) => (
            <li key={b.sortOrder}>
              Block {b.sortOrder}: {b.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
