import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function CalendarSyncCard() {
  const [copied, setCopied] = useState(false);

  // Push 66 (2026-05-13) — surface calendar owner email so Mom can
  // confirm which account the ICS subscription is published under.
  const ownerQ = (trpc as any).prefs?.get?.useQuery?.({ key: "calendar.ownerEmail" });
  const studentQ = (trpc as any).prefs?.get?.useQuery?.({ key: "student.googleEmail" });
  const ownerEmail =
    (ownerQ?.data as string | null) || (studentQ?.data as string | null) || "reaganhiggs910@gmail.com";

  const feedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar.ics`
      : "/api/calendar.ics";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success("URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the URL and copy manually");
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
        <span>Owner email:</span>
        <code className="px-2 py-0.5 rounded bg-muted/60">{ownerEmail}</code>
      </div>

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
