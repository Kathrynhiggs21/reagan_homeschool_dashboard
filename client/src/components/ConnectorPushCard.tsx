/**
 * ConnectorPushCard (v3.21, 2026-05-31)
 * =====================================
 *
 * Renders the Drive Connector status panel inside Settings. Surfaces:
 *
 *   - Queue depth (rows in `drive_push_queue` with `status='pending'`)
 *   - Last drainer run summary (when, by whom, pushed/skipped/failed counts)
 *   - One-click "copy command" line so the admin can paste into the
 *     project shell to drain the queue
 *   - A short table of the most recent 10 queue rows (status + folder
 *     + filename) for quick "did my upload land?" verification
 *
 * The card is admin-only — it short-circuits to a friendly stub for
 * non-admin viewers since `trpc.drive.connectorLastRun` requires
 * adminProcedure on the server.
 *
 * NOTE: the actual gws upload work happens in
 * `scripts/drive-connector-drainer.mjs` (Manus sandbox shell only).
 * This card never invokes gws — it just exposes the inputs the admin
 * needs to run that script.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

/** ISO → "May 31, 2026 00:14 UTC" rendering in the user's locale */
function fmtISO(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Truncate long file names to keep the table tidy */
function truncate(s: string, n = 48): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export default function ConnectorPushCard() {
  const auth = useAuth?.();
  const isAdmin = (auth as any)?.user?.role === "admin";

  const lastRunQ = (trpc as any).drive?.connectorLastRun?.useQuery?.(
    undefined,
    { staleTime: 60_000, enabled: isAdmin },
  );
  const pendingQ = (trpc as any).drive?.pending?.useQuery?.(undefined, {
    staleTime: 30_000,
    enabled: isAdmin,
  });
  const recentQ = (trpc as any).drive?.recent?.useQuery?.(
    { limit: 10 },
    { staleTime: 30_000, enabled: isAdmin },
  );

  const [copied, setCopied] = useState<string | null>(null);

  const lastRun = (lastRunQ?.data ?? null) as null | {
    atISO: string | null;
    pushed: number | null;
    skipped: number | null;
    failed: number | null;
    scanned: number | null;
    byUser: string | null;
  };

  const pendingCount: number = Array.isArray(pendingQ?.data)
    ? (pendingQ.data as any[]).length
    : 0;

  /**
   * The shell command the admin will paste into the sandbox terminal.
   * The bearer is intentionally NOT printed in the card — the admin
   * already has it in their browser cookie store; we surface a tip for
   * pulling it out via DevTools instead. (Surfacing a long-lived bearer
   * in a static card is a footgun.)
   */
  const drainCommand = useMemo(() => {
    return `cd /home/ubuntu/reagan_homeschool_dashboard \\\n  && DASHBOARD_BEARER=$(echo "$YOUR_DASHBOARD_COOKIE") \\\n  pnpm drive:drain`;
  }, []);

  if (!isAdmin) {
    return (
      <Card data-testid="connector-push-card-stub">
        <CardHeader>
          <CardTitle className="text-base">Drive Connector</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Drive auto-mirror is admin-only. Sign in as an admin to see queue
          depth and run the connector.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="connector-push-card" data-testid="connector-push-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          Drive Connector
          {pendingCount > 0 ? (
            <Badge variant="secondary" data-testid="connector-pending-badge">
              {pendingCount} pending
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-emerald-700 border-emerald-300"
              data-testid="connector-pending-badge"
            >
              queue empty
            </Badge>
          )}
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          v3.21 · sandbox-only
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Drains the queue into{" "}
          <span className="font-medium text-foreground">
            Reagan School Hub (Dashboard)
          </span>{" "}
          on Mom's Drive (<code>spear.cpt@gmail.com</code>) using the Manus
          Drive connector. No Cloud Console / OAuth setup required. Runs only
          while a Manus sandbox session is active — not on the production
          schedule.
        </p>

        {/* Last run summary */}
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Last run
          </div>
          {lastRun?.atISO ? (
            <div className="mt-1" data-testid="connector-last-run">
              <div>
                <span className="font-medium">{fmtISO(lastRun.atISO)}</span>
                {lastRun.byUser ? (
                  <span className="text-muted-foreground"> · by {lastRun.byUser}</span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs">
                <span className="text-emerald-700">
                  pushed {lastRun.pushed ?? 0}
                </span>
                {" · "}
                <span className="text-amber-700">
                  skipped {lastRun.skipped ?? 0}
                </span>
                {" · "}
                <span className="text-rose-700">
                  failed {lastRun.failed ?? 0}
                </span>
                {" · "}
                <span className="text-muted-foreground">
                  scanned {lastRun.scanned ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="mt-1 text-xs text-muted-foreground"
              data-testid="connector-last-run-empty"
            >
              The drainer hasn't run yet. Use the command below from the
              project shell to do the first drain.
            </div>
          )}
        </div>

        {/* Drain command */}
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Drain command (run from sandbox shell)
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-background"
              onClick={() => {
                void navigator.clipboard
                  .writeText(drainCommand)
                  .then(() => {
                    setCopied("ok");
                    toast.success("Command copied");
                    setTimeout(() => setCopied(null), 2_000);
                  })
                  .catch(() => {
                    setCopied("err");
                    toast.error(
                      "Couldn't copy — paste manually from the box below",
                    );
                  });
              }}
              data-testid="connector-copy-command"
            >
              {copied === "ok" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] leading-snug bg-background border rounded p-2 font-mono">
            {drainCommand}
          </pre>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              Where do I get the dashboard bearer?
            </summary>
            <div className="mt-1 space-y-1">
              <p>
                In your dashboard browser tab open DevTools → Application →
                Cookies → choose this site → copy the value of the
                <code className="mx-1 rounded bg-muted px-1">__Host-msession</code>
                cookie. That string is what goes into{" "}
                <code className="mx-1 rounded bg-muted px-1">DASHBOARD_BEARER</code>.
              </p>
              <p>
                The cookie is short-lived (~30 days). When the drainer fails
                with a 401 or 403, refresh this page (which refreshes the
                cookie) and re-copy.
              </p>
            </div>
          </details>
        </div>

        {/* Recent rows */}
        <div className="rounded-md border">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
            Recent queue rows (10 most recent)
          </div>
          {Array.isArray(recentQ?.data) && (recentQ.data as any[]).length > 0 ? (
            <div className="divide-y">
              {(recentQ.data as any[]).slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto,1fr,auto] gap-3 px-3 py-2 text-xs items-center"
                  data-testid={`connector-recent-row-${r.id}`}
                >
                  <span
                    className={
                      "rounded px-1.5 py-0.5 font-mono " +
                      (r.status === "pushed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : r.status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : r.status === "failed"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-muted text-muted-foreground border")
                    }
                  >
                    {r.status}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium truncate" title={r.fileName}>
                      {truncate(r.fileName, 64)}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {r.targetFolder}
                      {r.targetSubpath ? ` · ${r.targetSubpath}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    #{r.id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Queue history is empty. Once the dashboard enqueues files (day
              logs, recap replies, agenda PDFs, classifier-routed uploads)
              they'll show here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
