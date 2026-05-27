/**
 * AutomationHealthCard
 *
 * v2.97.3 (2026-05-27) — In Settings → Email tab. Shows every Heartbeat
 * cron registered for this project + last-fired time + next-fire time +
 * health pill. Owner-only (adminProcedure on the backend).
 *
 * Why this exists: the nightly agenda email silently timed out for weeks
 * before anyone noticed. This card gives Mom a glance-and-go health view
 * so degradation is visible without anyone having to ask the agent.
 */
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatTime12h } from "@/lib/time12h";
import { RefreshCw, Activity, AlertTriangle, Clock, Pause, Sparkles } from "lucide-react";

type JobStatus = "paused" | "never_run" | "healthy" | "stale";

const statusToLabel: Record<JobStatus, string> = {
  paused: "Paused",
  never_run: "Not yet run",
  healthy: "Healthy",
  stale: "Stale — check this",
};

const statusToVariant: Record<JobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paused: "outline",
  never_run: "secondary",
  healthy: "default",
  stale: "destructive",
};

const statusToIcon: Record<JobStatus, ReactElement> = {
  paused: <Pause className="h-3.5 w-3.5" />,
  never_run: <Sparkles className="h-3.5 w-3.5" />,
  healthy: <Activity className="h-3.5 w-3.5" />,
  stale: <AlertTriangle className="h-3.5 w-3.5" />,
};

function formatLocalDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const dateStr = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${dateStr} ${formatTime12h(`${hh}:${mm}`)}`;
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const delta = Date.now() - t;
    const abs = Math.abs(delta);
    const min = Math.round(abs / 60000);
    if (min < 1) return delta >= 0 ? "just now" : "in <1m";
    if (min < 60) return delta >= 0 ? `${min}m ago` : `in ${min}m`;
    const hr = Math.round(min / 60);
    if (hr < 24) return delta >= 0 ? `${hr}h ago` : `in ${hr}h`;
    const day = Math.round(hr / 24);
    return delta >= 0 ? `${day}d ago` : `in ${day}d`;
  } catch {
    return "";
  }
}

export function AutomationHealthCard() {
  const q = trpc.system.heartbeatHealth.useQuery(undefined, {
    refetchInterval: 60_000, // refresh once a minute while the card is mounted
  });
  const utils = trpc.useUtils();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Automation health
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => utils.system.heartbeatHealth.invalidate()}
            disabled={q.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
            <span className="ml-1 text-xs">Refresh</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Live status of every scheduled job (nightly agenda email, evening auto-attach, daily recap, etc.).
          A red pill means the job hasn&apos;t fired in much longer than its schedule expects.
        </p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="text-xs text-muted-foreground py-4">Loading…</div>
        ) : !q.data?.ok ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-medium">Couldn&apos;t reach the heartbeat service.</div>
            <div className="opacity-80">{(q.data as any)?.error ?? "Unknown error"}</div>
          </div>
        ) : q.data.jobs.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">
            No heartbeat jobs registered for this project yet.
          </div>
        ) : (
          <ul className="divide-y">
            {q.data.jobs.map((job) => {
              const s = job.status as JobStatus;
              return (
                <li key={job.taskUid} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{job.name}</span>
                        <Badge
                          variant={statusToVariant[s]}
                          className="text-[10px] uppercase tracking-wide flex items-center gap-1"
                        >
                          {statusToIcon[s]}
                          {statusToLabel[s]}
                        </Badge>
                      </div>
                      {job.description ? (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {job.description}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last: {formatLocalDateTime(job.lastFiredAt)}
                          {job.lastFiredAt ? (
                            <span className="opacity-70 ml-1">({relativeTime(job.lastFiredAt)})</span>
                          ) : null}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          → Next: {formatLocalDateTime(job.nextFireAt)}
                          {job.nextFireAt ? (
                            <span className="opacity-70 ml-1">({relativeTime(job.nextFireAt)})</span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {q.data?.fetchedAt ? (
          <div className="text-[10px] text-muted-foreground mt-3 text-right">
            Refreshed {relativeTime(q.data.fetchedAt)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AutomationHealthCard;
