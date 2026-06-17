import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Copy, Check, Mail, IdCard, ExternalLink, UploadCloud, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Live one-way push section: mirrors the dashboard's schedule blocks to
 * the "Reagan's Homeschool" Google Calendar via the calendar.* tRPC
 * procedures. Credential-gated server-side — when no Google Calendar
 * token is configured the buttons stay disabled with a clear note.
 */
function CalendarPushSection() {
  const statusQ = trpc.calendar.credentialStatus.useQuery(undefined, { staleTime: 60_000 });
  const syncDay = trpc.calendar.syncDay.useMutation();
  const syncRange = trpc.calendar.syncRange.useMutation();
  const ready = statusQ.data?.ready === true;
  const busy = syncDay.isPending || syncRange.isPending;
  const todayStr = new Date().toISOString().slice(0, 10);

  const pushToday = () =>
    syncDay.mutate(
      { dateISO: todayStr },
      {
        onSuccess: (r) =>
          toast.success(`Today synced: ${r.eventsCreated} created, ${r.eventsUpdated} updated, ${r.eventsDeleted} removed${r.errorCount ? `, ${r.errorCount} errors` : ""}`),
        onError: (e) => toast.error(e.message),
      },
    );

  const pushPilot = () =>
    syncRange.mutate(
      { startISO: "2026-06-17", endISO: "2026-06-30" },
      {
        onSuccess: (r) =>
          toast.success(`2-week pilot synced: ${r.totals.eventsCreated} created, ${r.totals.eventsUpdated} updated, ${r.totals.eventsDeleted} removed${r.totals.errorCount ? `, ${r.totals.errorCount} errors` : ""}`),
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2" data-testid="calendar-push-section">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <UploadCloud className="w-3.5 h-3.5" />
        <span>Push schedule to Google Calendar (one-way)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Writes each school block as a timed event on Reagan&apos;s Homeschool calendar.
        Re-running is safe — events update in place and removed blocks are deleted.
      </p>
      {statusQ.isLoading ? (
        <div className="text-[11px] text-muted-foreground">Checking calendar connection…</div>
      ) : ready ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-7" disabled={busy} onClick={pushToday} data-testid="calendar-push-today">
            {busy ? "Syncing…" : "Sync today"}
          </Button>
          <Button size="sm" variant="secondary" className="h-7" disabled={busy} onClick={pushPilot} data-testid="calendar-push-pilot">
            {busy ? "Syncing…" : "Sync 2-week pilot (Jun 17–30)"}
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400" data-testid="calendar-push-disabled">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Not connected yet. Add a Google Calendar credential
            (<code>GOOGLE_CALENDAR_OAUTH_TOKEN</code>) in Settings → Secrets to enable
            one-tap pushing. The dashboard also auto-syncs after a planner commit once connected.
          </span>
        </div>
      )}
    </div>
  );
}

export default function CalendarSyncCard() {
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<"feed" | "id" | null>(null);

  // Push 66 (2026-05-13) — surface calendar owner email so Mom can
  // confirm which account the ICS subscription is published under.
  const ownerQ = (trpc as any).prefs?.get?.useQuery?.({ key: "calendar.ownerEmail" });
  const studentQ = (trpc as any).prefs?.get?.useQuery?.({ key: "student.googleEmail" });
  // v2.32 (2026-05-18) — Calendar identity rows. The calendar ID is the
  // canonical Google Calendar id used by the dashboard read/write paths;
  // the `id.ownerEmail` is the account that OWNS the calendar (vs. the
  // ICS subscriber `ownerEmail`). Both are read-only on this card; Mom can
  // edit them from Settings → prefs (familyAdmin-gated).
  const calIdQ = (trpc as any).prefs?.get?.useQuery?.({ key: "calendar.id" });
  const calIdOwnerQ = (trpc as any).prefs?.get?.useQuery?.({ key: "calendar.id.ownerEmail" });
  const ownerEmail =
    (ownerQ?.data as string | null) || (studentQ?.data as string | null) || "reaganhiggs910@gmail.com";
  const calendarId =
    (calIdQ?.data as string | null) ||
    "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com";
  const calendarOwnerEmail =
    (calIdOwnerQ?.data as string | null) || "spear.cpt@gmail.com";

  const feedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar.ics`
      : "/api/calendar.ics";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setCopiedField("feed");
      toast.success("URL copied");
      setTimeout(() => { setCopied(false); setCopiedField(null); }, 2000);
    } catch {
      toast.error("Couldn't copy — select the URL and copy manually");
    }
  };

  const copyCalendarId = async () => {
    try {
      await navigator.clipboard.writeText(calendarId);
      setCopiedField("id");
      toast.success("Calendar ID copied");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Couldn't copy — select the ID and copy manually");
    }
  };

  return (
    <Card className="classroom-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-sky-500" />
        <div className="font-display text-lg font-semibold">Google Calendar sync</div>
      </div>
      <p className="text-sm text-muted-foreground">
        Subscribe Google Calendar (or Apple Calendar, Outlook, etc.) to Reagan's
        classroom. Today's schedule blocks, timeline events, and pinned
        whiteboard notes will appear and auto-refresh.
      </p>

      <div className="flex gap-2 items-center">
        <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 break-all">
          {feedUrl}
        </code>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {/* Push 66 (2026-05-13) — calendar identity row */}
      <div
        data-testid="calendar-owner-row"
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Mail className="w-3.5 h-3.5" />
        <span>ICS subscriber:</span>
        <code className="px-2 py-0.5 rounded bg-muted/60">{ownerEmail}</code>
      </div>

      {/* v2.32 (2026-05-18) — canonical Google Calendar identity. */}
      <div
        data-testid="calendar-identity-block"
        className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <IdCard className="w-3.5 h-3.5" />
          <span>Reagan's Homeschool calendar</span>
        </div>
        <div
          data-testid="calendar-id-row"
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="shrink-0">Calendar ID:</span>
          <code className="flex-1 min-w-0 px-2 py-1 rounded bg-background/60 break-all">
            {calendarId}
          </code>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={copyCalendarId}
            data-testid="calendar-id-copy-btn"
          >
            {copiedField === "id" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div
          data-testid="calendar-id-owner-row"
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Owner account:</span>
          <code className="px-2 py-0.5 rounded bg-background/60">{calendarOwnerEmail}</code>
          <a
            href={`https://calendar.google.com/calendar/u/0/r/settings/calendar/${encodeURIComponent(calendarId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline ml-auto"
            data-testid="calendar-id-google-link"
          >
            Open in Google
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="text-[11px] text-muted-foreground italic">
          This is the canonical calendar the dashboard reads and writes.
          Mom owns it; the ICS subscriber above just receives a read-only
          mirror. Changing the ID rewires sync — ask before editing.
        </div>
      </div>

      <CalendarPushSection />

      <div className="text-xs text-muted-foreground space-y-1">
        <div className="font-semibold text-foreground">How to add in Google Calendar</div>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Open Google Calendar on desktop.</li>
          <li>Left sidebar → <b>Other calendars</b> → <b>+</b> → <b>From URL</b>.</li>
          <li>Paste the URL above and click <b>Add calendar</b>.</li>
          <li>It will refresh every few hours automatically.</li>
        </ol>
      </div>
    </Card>
  );
}
