/**
 * FamilyFeed.tsx \u2014 Phase 4
 *
 * One scrollable timeline that any adult in the home team can pull up on a
 * phone to see what Reagan has been doing today. Read-only by design.
 *
 * Combines schedule-block completions, work submissions, good-work notes
 * (encouragements from adults), and coin earns. Server returns up to 100
 * events; we render the latest 60 by default with a "Show more" button.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const KIND_META: Record<string, { emoji: string; chip: string; tint: string }> = {
  block_complete: { emoji: "\u2705", chip: "chip-green",  tint: "text-emerald-700" },
  submission:     { emoji: "\ud83d\udcdd", chip: "chip-blue",   tint: "text-blue-700" },
  good_work_note: { emoji: "\ud83d\udcab", chip: "chip-pink",   tint: "text-pink-700" },
  coin_earn:      { emoji: "\ud83e\ude99", chip: "chip-yellow", tint: "text-amber-700" },
};

function formatRelative(at: Date): string {
  const now = Date.now();
  const t = new Date(at).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(at).toLocaleDateString();
}

export default function FamilyFeed() {
  const [showAll, setShowAll] = useState(false);
  const feed = trpc.familyFeed.list.useQuery({ limit: 60 });
  const items = feed.data || [];
  const visible = showAll ? items : items.slice(0, 25);

  return (
    <div className="space-y-5">
      <header>
        <div className="font-chalk-hand text-xl leading-none chalk-yellow">For the home team</div>
        <h1 className="font-display text-4xl md:text-5xl mt-1 chalk-white">Family Update Stream</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Live snapshot of Reagan's day. Visible to Dad, Grandma Marcy, Madison, Sophie, and Keith.
        </p>
      </header>

      {feed.isLoading && <div className="text-sm text-muted-foreground">Loading\u2026</div>}
      {feed.error && (
        <Card className="classroom-card p-4 text-sm text-red-600">
          Couldn't load the feed: {feed.error.message}
        </Card>
      )}

      {!feed.isLoading && items.length === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display">Nothing logged yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            As Reagan completes blocks, turns in work, or earns coins, updates will land here.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((it: any) => {
          const meta = KIND_META[it.kind] || { emoji: "\u2728", chip: "chip-gray", tint: "" };
          return (
            <Card key={it.id} className="classroom-card p-4 flex gap-3 items-start">
              <span className={`time-chip ${meta.chip} !w-12 !h-12 !text-2xl !rounded-xl shrink-0 flex items-center justify-center`} aria-hidden>
                {meta.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`font-display font-semibold text-[15px] leading-tight ${meta.tint}`}>{it.title}</div>
                {it.detail && <div className="text-xs text-neutral-600 mt-0.5 truncate">{it.detail}</div>}
                <div className="text-[11px] text-neutral-500 mt-1">
                  {it.authorName ? `${it.authorName} \u00b7 ` : ""}{formatRelative(new Date(it.at))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {items.length > 25 && !showAll && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Show {items.length - 25} more
          </Button>
        </div>
      )}
    </div>
  );
}
