/**
 * ConnectorPushCard (v3.23, 2026-05-31)
 * =====================================
 *
 * Renders the Drive Connector status panel inside Settings. Surfaces:
 *
 *   - Queue depth (rows in `drive_push_queue` with `status='pending'`)
 *   - Last drainer run summary (when, by whom, pushed/skipped/failed counts)
 *   - v3.23: One-click "Copy drain command" button — mints a short-lived
 *     drainer token via `drive.connectorMintToken`, copies the full
 *     ready-to-paste shell line (no DevTools required). Falls back to a
 *     bearer-cookie command if the mint mutation fails or isn't loaded.
 *   - v3.23: Recent-rows table with status chips, folder dropdown,
 *     filename search, sort toggle, result count, and clear-filters
 *     link. Server ceiling raised to 50 rows.
 *
 * The card is admin-only — it short-circuits to a friendly stub for
 * non-admin viewers since the underlying procs require adminProcedure.
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  applyFiltersAndSort,
  EMPTY_FILTERS,
  filtersAreActive,
  formatResultCount,
  listKnownFolders,
  type ConnectorSortKey,
  type ConnectorStatusFilter,
  type ConnectorTableFilters,
  type RecentRow,
} from "@/lib/driveConnectorTable";

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

const STATUS_OPTIONS: { value: ConnectorStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pushed", label: "Pushed" },
  { value: "pending", label: "Pending" },
  { value: "skipped", label: "Skipped" },
  { value: "failed", label: "Failed" },
];

const SORT_OPTIONS: { value: ConnectorSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "status", label: "Status" },
  { value: "folder", label: "Folder" },
  { value: "id", label: "ID" },
];

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
    { limit: 50 },
    { staleTime: 30_000, enabled: isAdmin },
  );

  const mintTokenM = (trpc as any).drive?.connectorMintToken?.useMutation?.();

  const [copied, setCopied] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<ConnectorTableFilters>(EMPTY_FILTERS);

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

  const rawRows: RecentRow[] = Array.isArray(recentQ?.data)
    ? ((recentQ.data as any[]).map((r) => ({
        id: r.id,
        fileName: r.fileName,
        status: r.status,
        targetFolder: r.targetFolder,
        targetSubpath: r.targetSubpath ?? null,
        createdAt: r.createdAt ?? null,
      })) as RecentRow[])
    : [];

  const folderOptions = useMemo(() => listKnownFolders(rawRows), [rawRows]);
  const filteredRows = useMemo(
    () => applyFiltersAndSort(rawRows, filters),
    [rawRows, filters],
  );
  const isFiltered = filtersAreActive(filters);
  const countLine = formatResultCount(
    filteredRows.length,
    rawRows.length,
    isFiltered,
  );

  /**
   * Mint a fresh drainer token and copy a ready-to-paste shell line.
   * Falls back to the bearer-cookie command if the mint fails for any
   * reason (offline, server out of date, etc.) so the card still works.
   */
  const onCopyCommand = async () => {
    try {
      if (mintTokenM?.mutateAsync) {
        const res = await mintTokenM.mutateAsync({ ttlSeconds: 15 * 60 });
        const dashboardUrl = window.location.origin;
        const cmd = `cd /home/ubuntu/reagan_homeschool_dashboard \\\n  && DASHBOARD_URL='${dashboardUrl}' \\\n  DRAINER_TOKEN='${res.token}' \\\n  pnpm drive:drain`;
        await navigator.clipboard.writeText(cmd);
        setCopied("ok");
        toast.success(
          `Command copied — token expires ${new Date(res.expiresAtISO).toLocaleTimeString()}`,
        );
        setTimeout(() => setCopied(null), 2_500);
        return;
      }
    } catch (e) {
      // fall through to bearer fallback
      // eslint-disable-next-line no-console
      console.warn("[ConnectorPushCard] mint failed, using bearer fallback", e);
    }
    const fallback = `cd /home/ubuntu/reagan_homeschool_dashboard \\\n  && DASHBOARD_BEARER='paste-__Host-msession-cookie-here' \\\n  pnpm drive:drain`;
    try {
      await navigator.clipboard.writeText(fallback);
      setCopied("fallback");
      toast.warning("Token mint unavailable — copied bearer-cookie command instead");
      setTimeout(() => setCopied(null), 3_000);
    } catch {
      setCopied("err");
      toast.error("Couldn't copy — paste manually from the box below");
    }
  };

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
          v3.23 · sandbox-only
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
                void onCopyCommand();
              }}
              disabled={mintTokenM?.isPending}
              data-testid="connector-copy-command"
            >
              {mintTokenM?.isPending
                ? "Minting…"
                : copied === "ok"
                  ? "Copied"
                  : copied === "fallback"
                    ? "Copied (fallback)"
                    : "Copy drain command"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Click <span className="font-semibold">Copy drain command</span> to
            mint a 15-minute drainer token and copy the ready-to-paste shell
            line. Paste into the project shell and press Enter — no DevTools,
            no cookie hunting.
          </p>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              Token didn't work? Use the cookie-fallback path.
            </summary>
            <div className="mt-1 space-y-1">
              <p>
                In your dashboard browser tab open DevTools → Application →
                Cookies → choose this site → copy the value of the
                <code className="mx-1 rounded bg-muted px-1">__Host-msession</code>
                cookie. Then run:
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-snug bg-background border rounded p-2 font-mono">
                {`cd /home/ubuntu/reagan_homeschool_dashboard \\\n  && DASHBOARD_BEARER='paste-cookie-value' \\\n  pnpm drive:drain`}
              </pre>
            </div>
          </details>
        </div>

        {/* Recent rows with filter/sort */}
        <div className="rounded-md border">
          <div className="px-3 py-2 border-b bg-muted/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent queue rows
              </div>
              <div
                className="text-[11px] text-muted-foreground"
                data-testid="connector-result-count"
              >
                {countLine}
              </div>
            </div>
            {/* Status chips */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="connector-status-chips"
            >
              {STATUS_OPTIONS.map((opt) => {
                const active = filters.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({ ...f, status: opt.value }))
                    }
                    className={
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition " +
                      (active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background hover:bg-muted")
                    }
                    data-testid={`connector-status-chip-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {isFiltered ? (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="ml-auto text-[11px] underline text-muted-foreground hover:text-foreground"
                  data-testid="connector-clear-filters"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            {/* Folder + search + sort */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filters.folder || "_all"}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, folder: v === "_all" ? "" : v }))
                }
              >
                <SelectTrigger
                  className="h-8 w-[160px] text-xs"
                  data-testid="connector-folder-select"
                >
                  <SelectValue placeholder="All folders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All folders</SelectItem>
                  {folderOptions.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                placeholder="Search file name…"
                className="h-8 max-w-[220px] text-xs"
                data-testid="connector-search-input"
              />
              <Select
                value={filters.sortBy}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    sortBy: v as ConnectorSortKey,
                  }))
                }
              >
                <SelectTrigger
                  className="h-8 w-[120px] text-xs ml-auto"
                  data-testid="connector-sort-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredRows.length > 0 ? (
            <div className="divide-y" data-testid="connector-recent-rows">
              {filteredRows.map((r) => (
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
          ) : rawRows.length > 0 ? (
            <div
              className="px-3 py-3 text-xs text-muted-foreground"
              data-testid="connector-recent-empty-filtered"
            >
              No rows match the current filters.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                Clear filters
              </button>
              .
            </div>
          ) : (
            <div
              className="px-3 py-3 text-xs text-muted-foreground"
              data-testid="connector-recent-empty"
            >
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
