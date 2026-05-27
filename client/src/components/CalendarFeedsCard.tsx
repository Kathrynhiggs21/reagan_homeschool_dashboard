/**
 * CalendarFeedsCard
 * -----------------
 * Adult-only card for the "For Mom & Grandma" drawer on /today.
 *
 * Lets a trusted adult paste a secret iCal URL (e.g. the "Secret address in
 * iCal format" copied from a Google Calendar's settings) and have the dashboard
 * sync those events into the unified calendar overlay. Each feed gets a label
 * and an accent color so events show up clearly against Reagan's school plan.
 *
 * Wraps trpc.icalFeeds.add / list / delete / refresh — all of which were
 * already implemented; this is purely the missing UI.
 *
 * Added in v2.92 (2026-05-27) after Katy asked for the spear.cpt@gmail.com
 * "reagan" calendar to flow into the dashboard.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const PRESET_COLORS = [
  { value: "#0a66c2", name: "Blue" },
  { value: "#16a34a", name: "Green" },
  { value: "#dc2626", name: "Red" },
  { value: "#9333ea", name: "Purple" },
  { value: "#ea580c", name: "Orange" },
  { value: "#0891b2", name: "Teal" },
];

function relativeAgo(ts: string | Date | null | undefined): string {
  if (!ts) return "never";
  const d = ts instanceof Date ? ts : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CalendarFeedsCard() {
  const utils = trpc.useUtils();
  const { data: feeds, isLoading } = trpc.icalFeeds.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // form state
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].value);

  const add = trpc.icalFeeds.add.useMutation({
    onSuccess: () => {
      toast.success(`Added "${label}" — syncing now…`);
      setLabel("");
      setUrl("");
      setColor(PRESET_COLORS[0].value);
      setShowForm(false);
      utils.icalFeeds.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Could not add calendar: ${err.message ?? "unknown error"}`);
    },
  });

  const refresh = trpc.icalFeeds.refresh.useMutation({
    onSuccess: (r) => {
      toast.success(`Synced — ${r.count} events`);
      utils.icalFeeds.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message ?? "unknown error"}`);
      utils.icalFeeds.list.invalidate();
    },
  });

  const remove = trpc.icalFeeds.delete.useMutation({
    onSuccess: () => {
      toast.success("Calendar removed");
      utils.icalFeeds.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Could not remove: ${err.message ?? "unknown error"}`);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    add.mutate({ label: label.trim(), url: url.trim(), color });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">📅 Calendar feeds</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste a Google Calendar "Secret address in iCal format" URL to see
            those events alongside Reagan's school plan.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            + Add
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-2 pt-1 border-t pt-3">
          <div>
            <Label htmlFor="cal-label" className="text-xs">Label</Label>
            <Input
              id="cal-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Reagan's calendar"
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="cal-url" className="text-xs">Secret iCal URL</Label>
            <Input
              id="cal-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              Google Calendar → click the "reagan" calendar → Settings →
              "Integrate calendar" → copy "Secret address in iCal format"
              (long URL ending in <code>/basic.ics</code>).
            </p>
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5 mt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    color === c.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add calendar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
              disabled={add.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!isLoading && feeds && feeds.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {feeds.map((f: any) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded border p-2 text-sm"
            >
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: f.color }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {f.lastSyncStatus === "ok" && (
                    <>synced {relativeAgo(f.lastSyncedAt)} · {f.eventsCached} events</>
                  )}
                  {f.lastSyncStatus === "never" && <>not synced yet</>}
                  {f.lastSyncStatus === "failed" && (
                    <span className="text-destructive">sync failed — try refresh</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refresh.mutate({ id: f.id })}
                disabled={refresh.isPending}
                title="Refresh now"
              >
                ↻
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove "${f.label}"?`)) remove.mutate({ id: f.id });
                }}
                disabled={remove.isPending}
                title="Remove"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && feeds && feeds.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic pt-1">
          No calendars connected yet. Click "+ Add" to wire one up.
        </p>
      )}
    </Card>
  );
}
