import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const FOLDER_LABEL: Record<string, string> = {
  reagan: "Drive › Reagan",
  reagan_ihes: "Drive › Reagan › IHES",
  reagan_tutor: "Drive › Reagan › Tutor",
  reagan_artwork: "Drive › Reagan › Artwork",
  reagan_assignments: "Drive › Reagan › Assignments",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  pushed: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  skipped: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  failed: "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

export default function DrivePushQueueCard() {
  const recent = trpc.drive.recent.useQuery({ limit: 12 }, { refetchInterval: 60_000 });
  const rows: any[] = (recent.data as any[]) ?? [];
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { pending: 0, pushed: 0, skipped: 0, failed: 0 } as Record<string, number>,
  );

  return (
    <Card className="p-5 border-2 border-blue-300/30 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-emerald-500/5">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-300" />
            Google Drive auto-mirror
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Every file you upload here is also copied to your Reagan Google Drive folder by the daily 6:30 AM job.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={STATUS_BADGE.pushed}><CheckCircle2 className="w-3 h-3 mr-1" />{counts.pushed} pushed</Badge>
          <Badge className={STATUS_BADGE.pending}><Clock className="w-3 h-3 mr-1" />{counts.pending} pending</Badge>
          {counts.failed > 0 && (
            <Badge className={STATUS_BADGE.failed}><AlertTriangle className="w-3 h-3 mr-1" />{counts.failed} failed</Badge>
          )}
        </div>
      </header>

      {recent.isLoading && <div className="text-sm text-muted-foreground">Loading queue&hellip;</div>}

      {!recent.isLoading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          No files queued yet. Upload anything below and it will appear here, then sync to Drive on the next 6:30 AM run.
        </div>
      )}

      {!recent.isLoading && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 text-sm rounded-md border border-white/10 bg-background/30 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium" title={r.fileName}>{r.fileName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {FOLDER_LABEL[r.targetFolder] ?? r.targetFolder} ·{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {r.errorMessage ? ` · ${String(r.errorMessage).slice(0, 80)}` : ""}
                </div>
              </div>
              <Badge className={STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}>{r.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
