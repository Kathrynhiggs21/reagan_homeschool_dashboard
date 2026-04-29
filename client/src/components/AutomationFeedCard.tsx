import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SOURCE_EMOJI: Record<string, string> = {
  gmail: "📧",
  drive: "📂",
  manual: "✋",
  scheduled: "⏰",
};

const ROUTE_LABEL: Record<string, string> = {
  submission: "Reagan's work",
  appLink: "Apps & Tools",
  book: "Bookshelf",
  tutorSession: "Tutor session",
  timelineEvent: "Timeline note",
  weeklyTopic: "IH curriculum",
};

export default function AutomationFeedCard() {
  const utils = trpc.useUtils();
  const status = trpc.upload.automationStatus.useQuery(undefined, { refetchInterval: 60_000 });
  const items = trpc.upload.recentItems.useQuery({ limit: 30 });
  const [showAll, setShowAll] = useState(false);

  const dismiss = trpc.upload.dismissItem.useMutation({
    onSuccess: () => {
      utils.upload.recentItems.invalidate();
      utils.upload.automationStatus.invalidate();
      toast.success("Dismissed");
    },
  });
  const flag = trpc.upload.flagItem.useMutation({
    onSuccess: () => {
      utils.upload.recentItems.invalidate();
      utils.upload.automationStatus.invalidate();
      toast.success("Flagged for follow-up");
    },
  });

  const s = status.data;
  const all = items.data ?? [];
  const visible = showAll ? all : all.slice(0, 8);
  const lastRunStr = s?.latestRunAt
    ? new Date(s.latestRunAt as any).toLocaleString()
    : "Has not run yet";

  return (
    <Card className="border-2 border-amber-300/40 bg-gradient-to-br from-amber-50/5 to-purple-50/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">⏰ What ran automatically</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Daily 6:30 AM — Gmail + Google Drive sync. You only see exceptions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {s?.latestRunStatus === "ok" && <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">✓ OK</Badge>}
            {s?.latestRunStatus === "errors" && <Badge className="bg-red-500/20 text-red-700 dark:text-red-300">⚠ errors</Badge>}
            {s?.latestRunStatus === "running" && <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300">running…</Badge>}
            {!s?.latestRunStatus && <Badge variant="outline">never run</Badge>}
            {(s?.pendingFlags ?? 0) > 0 && (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {s!.pendingFlags} flagged
              </Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Last run: <span className="font-mono">{lastRunStr}</span>
          {(s?.last7DaysItems ?? 0) > 0 && <span className="ml-2">· {s!.last7DaysItems} items in last 7 days</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {all.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nothing has synced yet. The first scheduled run kicks in tomorrow at 6:30 AM, or hit
            <span className="font-medium text-foreground"> Sync now </span>
            on the Upload or Sync page.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((it: any) => (
              <li
                key={it.id}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                  it.dismissed ? "opacity-50" : it.flagged ? "border-amber-400 bg-amber-50/10" : ""
                }`}
              >
                <span className="text-lg leading-none">{SOURCE_EMOJI[it.source] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.title || "(untitled)"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {ROUTE_LABEL[it.routedTo] ?? it.routedTo} · {new Date(it.createdAt).toLocaleString()}
                  </div>
                  {it.message && (
                    <div className="text-xs text-muted-foreground/80 mt-0.5 truncate">{it.message}</div>
                  )}
                  {it.parentNote && (
                    <div className="text-xs italic text-amber-600 dark:text-amber-300 mt-0.5">
                      Note: {it.parentNote}
                    </div>
                  )}
                </div>
                {!it.dismissed && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => flag.mutate({ itemId: it.id })}
                      disabled={flag.isPending}
                    >
                      🚩
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => dismiss.mutate({ itemId: it.id })}
                      disabled={dismiss.isPending}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {all.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show less" : `Show all ${all.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
