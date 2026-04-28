import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function CalendarSyncCard() {
  const [copied, setCopied] = useState(false);
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
