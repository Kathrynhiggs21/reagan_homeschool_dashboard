/**
 * GoogleCalendarEmbed
 * -------------------
 * Shows a read-only Google Calendar iframe widget when any icalFeed has a
 * `gcalEmbedUrl` set. Adults paste the Google Calendar embed URL from
 * Settings → Calendars. The iframe is sandboxed and read-only.
 *
 * Hides itself if no feeds have a gcalEmbedUrl configured.
 */
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface Props {
  /** compact = 300px tall (Today page); full = 500px (Schedule page) */
  size?: "compact" | "full";
}

export default function GoogleCalendarEmbed({ size = "compact" }: Props) {
  const feedsQ = trpc.icalFeeds.list.useQuery(undefined, { staleTime: 60_000 });
  const feeds: any[] = feedsQ.data || [];

  // Find the first feed with a gcalEmbedUrl
  const embedFeed = feeds.find((f) => f.gcalEmbedUrl && f.enabled);
  if (!embedFeed) return null;

  const height = size === "full" ? 500 : 300;

  return (
    <Card className="overflow-hidden border border-border">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{embedFeed.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">Read-only</span>
      </div>
      <iframe
        src={embedFeed.gcalEmbedUrl}
        style={{ border: 0, width: "100%", height }}
        frameBorder="0"
        scrolling="no"
        title={`${embedFeed.label} calendar`}
        sandbox="allow-scripts allow-same-origin"
      />
    </Card>
  );
}
