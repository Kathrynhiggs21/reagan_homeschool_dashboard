import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, CheckCircle2, AlertTriangle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { DRIVE_HUB_URL } from "./CozyShell";

const FOLDER_LABEL: Record<string, string> = {
  reagan:               "Drive › Reagan (root)",
  reagan_ihes:          "Drive › Reagan › IHES",
  reagan_tutor:         "Drive › Reagan › Tutor",
  reagan_artwork:       "Drive › Reagan › Artwork",
  reagan_assignments:   "Drive › Reagan › Assignments",
  finished_work:        "Drive › Finished Work",
  daily_schedule:       "Drive › Daily Schedule",
  worksheets:           "Drive › Worksheets",
  printables:           "Drive › Printables",
  report_cards:         "Drive › Report Cards",
  journal:              "Drive › Journal",
  analytics:            "Drive › Analytics",
  adult_notes:          "Drive › Adult Notes",
  kiwi_coins:           "Drive › Kiwi Coins",
  tutor:                "Drive › Tutor",
  apps_tools:           "Drive › Apps & Tools",
  bookshelf:            "Drive › Bookshelf",
  adventures:           "Drive › Adventures",
  practice:             "Drive › Practice",
  notebook:             "Drive › Notebook",
  curriculum_checklist: "Drive › Curriculum Checklist",
  day_log:              "Drive › Daily Operations › Day Logs",
  recap_reply:          "Drive › Daily Operations › Recap Replies",
  topics_covered:       "Drive › Curriculum › Topics Covered",
  agenda_pdf:           "Drive › Daily Operations › Agenda PDFs",
  classes:              "Drive › Classes",
  future_worksheets:    "Drive › Curriculum › Future Worksheets",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  pushed:  "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  skipped: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  failed:  "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 mr-1" />,
  pushed:  <CheckCircle2 className="w-3 h-3 mr-1" />,
  skipped: <Clock className="w-3 h-3 mr-1" />,
  failed:  <AlertTriangle className="w-3 h-3 mr-1" />,
};

import React from "react";

export default function DrivePushQueueCard() {
  const recent = trpc.drive.recent.useQuery({ limit: 20 }, { refetchInterval: 60_000 });
  const rows: any[] = (recent.data as any[]) ?? [];

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { pending: 0, pushed: 0, skipped: 0, failed: 0 } as Record<string, number>,
  );

  return (
    <Card className="p-5 border border-blue-300/20 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-emerald-500/5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400" />
            Google Drive mirror
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Files sync to Reagan's Drive at 6:30 AM daily.{" "}
            <a
              href={DRIVE_HUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              Open Drive <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {counts.pushed > 0 && (
            <Badge className={STATUS_BADGE.pushed} variant="outline">
              <CheckCircle2 className="w-3 h-3 mr-1" />{counts.pushed} synced
            </Badge>
          )}
          {counts.pending > 0 && (
            <Badge className={STATUS_BADGE.pending} variant="outline">
              <Clock className="w-3 h-3 mr-1" />{counts.pending} pending
            </Badge>
          )}
          {counts.failed > 0 && (
            <Badge className={STATUS_BADGE.failed} variant="outline">
              <AlertTriangle className="w-3 h-3 mr-1" />{counts.failed} failed
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => recent.refetch()}
            title="Refresh queue"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </header>

      {/* Loading */}
      {recent.isLoading && (
        <div className="text-sm text-muted-foreground py-2">Loading queue…</div>
      )}

      {/* Empty state */}
      {!recent.isLoading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground italic py-2">
          No files queued yet. Upload anything and it will appear here, then sync to Drive on the next 6:30 AM run.
        </div>
      )}

      {/* Queue rows */}
      {!recent.isLoading && rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 text-sm rounded-md border border-white/8 bg-background/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm" title={r.fileName}>
                  {r.fileName}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  <span className="text-blue-300/80">
                    {FOLDER_LABEL[r.targetFolder] ?? `Drive › ${r.targetFolder}`}
                  </span>
                  {" · "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {r.errorMessage && (
                    <span className="text-rose-400 ml-1" title={r.errorMessage}>
                      {" · "}⚠ {String(r.errorMessage).slice(0, 60)}
                    </span>
                  )}
                </div>
              </div>
              <Badge
                className={`${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending} shrink-0`}
                variant="outline"
              >
                {STATUS_ICON[r.status] ?? null}
                {r.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {/* Footer hint */}
      {!recent.isLoading && rows.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-white/10">
          Showing last {rows.length} items · Next sync at 6:30 AM ·{" "}
          <a
            href={DRIVE_HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            View all in Drive ↗
          </a>
        </p>
      )}
    </Card>
  );
}
