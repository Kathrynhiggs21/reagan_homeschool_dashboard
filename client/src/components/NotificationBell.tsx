import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, BellRing, Check, CheckCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * NotificationBell — adult-only in-app notification center.
 *
 * Design notes (per Katy's preferences):
 *  - Does NOT auto-open. It only opens on click. No pop-up / permission prompts.
 *  - Adult-only: the parent gates rendering on the adult unlock, so Reagan never
 *    sees the operational stream.
 *  - Surfaces real events the system already produces: kid "Make a request"
 *    submissions and "daily packet emailed" confirmations.
 *  - Unread badge + per-item mark-read + mark-all-read.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const listQuery = trpc.notifications.list.useQuery(undefined, {
    // Light polling so a new kid request / packet email shows up without a manual
    // refresh. 60s is gentle and there is no streaming here.
    refetchInterval: 60_000,
  });
  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const items = listQuery.data ?? [];
  const unread = unreadQuery.data?.count ?? 0;

  const typeAccent = (type: string) => {
    switch (type) {
      case "red_zone":
        return "#ef4444";
      case "milestone":
        return "#22c55e";
      case "block_complete":
        return "#3b82f6";
      case "reminder":
        return "#eab308";
      default:
        return "#94a3b8";
    }
  };

  const fmt = (d: string | Date) => {
    try {
      return new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 bg-background/60"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        >
          {unread > 0 ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              onClick={() => markAllRead.mutate(undefined)}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              You're all caught up.
            </div>
          ) : (
            items.map((n: any) => (
              <div
                key={n.id}
                className={`px-3 py-2.5 border-b last:border-b-0 flex gap-2.5 ${
                  n.read ? "opacity-60" : "bg-accent/30"
                }`}
              >
                <span
                  className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: typeAccent(n.type) }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <button
                    className="text-left w-full"
                    onClick={() => {
                      if (!n.read) markRead.mutate({ id: n.id });
                      if (n.link) {
                        setOpen(false);
                        navigate(n.link);
                      }
                    }}
                  >
                    <div className="text-[13px] font-medium leading-snug">
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {fmt(n.createdAt)}
                    </div>
                  </button>
                </div>
                {!n.read && (
                  <button
                    className="shrink-0 self-start text-muted-foreground hover:text-foreground"
                    title="Mark read"
                    aria-label="Mark read"
                    onClick={() => markRead.mutate({ id: n.id })}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
