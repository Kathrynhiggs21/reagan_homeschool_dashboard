import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * v2.89 (2026-05-23) — Manual "Send Daily Agenda Now" card.
 *
 * Mom reported (May 22) that the nightly 7 AM ET cron has not been
 * delivering emails. Diagnosis: the deployed
 * `/api/scheduled/nightly-agenda-email` endpoint is gated by a
 * Cloudflare-edge cron-cookie check that returns 403 to the heartbeat
 * task, so Job A never enqueues a real send. While the platform-side
 * gate is being repaired, this card lets Mom + Grandma push the agenda
 * with one tap directly from the dashboard. It calls the new
 * `nightlyAgenda.sendNow` mutation, which:
 *
 *   1. Assembles + builds today's agenda PDF.
 *   2. Pings the Manus owner-notification channel (push notification
 *      with the PDF download link, summary, and per-block list).
 *   3. Inserts + immediately marks the nightlyAgendaEmails row 'sent'
 *      so the audit trail and dispatch contract test stay correct.
 *
 * Lives inside the "For Mom & Grandma" drawer on Today; no kid-facing
 * surface ever sees it.
 */
export default function SendAgendaNowCard() {
  const [lastResult, setLastResult] = useState<{
    forDate: string;
    notified: boolean;
    signedUrl: string | null;
    blockCount: number;
    subject: string;
  } | null>(null);
  const send = trpc.nightlyAgenda.sendNow.useMutation({
    onSuccess: (res) => {
      if (!("ok" in res) || !res.ok) {
        toast.error(
          `No agenda for ${(res as any)?.forDate ?? "today"} — assemble a plan first.`,
        );
        return;
      }
      setLastResult({
        forDate: res.forDate,
        notified: res.notified,
        signedUrl: res.signedUrl,
        blockCount: res.blockCount,
        subject: res.subject,
      });
      if (res.notified) {
        toast.success(
          `Agenda sent for ${res.forDate} (${res.blockCount} block${res.blockCount === 1 ? "" : "s"}). Check your Manus notifications.`,
        );
      } else {
        toast.warning(
          `Agenda built but the notification channel rejected it. PDF link is shown below — open or forward manually.`,
        );
      }
    },
    onError: (err) => {
      toast.error(`Send failed: ${err.message}`);
    },
  });

  return (
    <Card
      className="classroom-card p-3"
      data-testid="send-agenda-now-card"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-display text-sm font-semibold chalk-white">
          Send today's agenda now
          <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
            for spear.cpt@gmail.com
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => send.mutate(undefined as any)}
          disabled={send.isPending}
        >
          {send.isPending ? "Sending…" : "📨 Send now"}
        </Button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Pushes the same PDF the nightly 8 PM cron would build, via Manus
        owner notifications. Use this if the morning email never showed up.
      </div>
      {lastResult && (
        <div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-2 text-xs chalk-white space-y-1">
          <div>
            <b>{lastResult.subject}</b>
          </div>
          <div>
            {lastResult.notified ? "✅ Sent" : "⚠ Notification failed"} ·{" "}
            {lastResult.blockCount} block
            {lastResult.blockCount === 1 ? "" : "s"} · {lastResult.forDate}
          </div>
          {lastResult.signedUrl && (
            <div>
              <a
                href={lastResult.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-amber-200"
              >
                Open the PDF
              </a>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
