import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Push 75 (2026-05-13) — Surface the per-type generated payload on Today.
 *
 * Reads `trpc.curriculum.generatedForDate` for `today`, then renders a
 * single calm line per block: printable label + optional "Open" button
 * when `operable.url` is set. Self-hides when the block already has
 * description / pageRefs / no generated payload — matches the no-info rule.
 */
export default function GeneratedBlockHint({
  blockId,
  hasPageRefs,
  hasDescription,
  todayDate,
}: {
  blockId: number;
  hasPageRefs: boolean;
  hasDescription: boolean;
  todayDate: string;
}) {
  // Single shared query — react-query dedupes across all instances on the same
  // page so this still only fires once per render even with many blocks.
  const q = trpc.curriculum.generatedForDate.useQuery(
    { date: todayDate },
    { staleTime: 60_000 },
  );

  if (hasPageRefs || hasDescription) return null;
  if (q.isLoading || !q.data) return null;
  const gen = q.data.byBlockId?.[blockId];
  if (!gen) return null;

  // v3.16 (2026-05-30) — video kind gets a Tap-to-play CTA + film emoji.
  const isVideo = (gen as any).kind === "video";
  const wrapClass = isVideo
    ? "mt-1.5 flex items-center gap-2 rounded-md bg-rose-300/15 border border-rose-300/35 px-2.5 py-1 text-[11px] text-rose-50"
    : "mt-1.5 flex items-center gap-2 rounded-md bg-amber-300/15 border border-amber-300/35 px-2.5 py-1 text-[11px] text-amber-50";
  const btnClass = isVideo
    ? "h-6 px-2 text-[10px] font-bold bg-rose-300 text-rose-950 hover:bg-rose-200 ml-auto"
    : "h-6 px-2 text-[10px] font-bold bg-amber-300 text-amber-950 hover:bg-amber-200 ml-auto";
  const ctaLabel = isVideo ? "▶ Tap to play" : "Open ↗";

  return (
    <div
      data-testid={`generated-hint-${blockId}`}
      data-kind={(gen as any).kind ?? "unknown"}
      className={wrapClass}
    >
      <span className="font-semibold truncate">{gen.printable}</span>
      {/* 2026-06-30 (Katy) reliability audit: only VIDEO blocks keep the
          external CTA (the video genuinely lives off-site). For worksheet/
          printable kinds we no longer surface a fragile external link here —
          tapping the block opens the in-app worksheet, which offers the
          reliable self-hosted "Print a paper copy" PDF. */}
      {isVideo && gen.operable?.url ? (
        <Button asChild size="sm" className={btnClass}>
          <a
            href={gen.operable.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`generated-open-${blockId}`}
          >
            {ctaLabel}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
