/**
 * RecapReplyInboxCard — v2.92 (2026-05-27)
 *
 * The Manus deployment edge silently 403s the nightly cron's cookie auth,
 * so although the dashboard sends out a "How did today go?" recap email
 * each evening, no parsed reply ever lands in `dailyRecapRequests`. 65 sent,
 * 0 parsed in production through end of May.
 *
 * This card surfaces every recap that is still waiting for an answer right
 * inside the adult drawer. Mom or a trusted helper can paste (or write) the
 * recap text and submit. That submission goes through the new
 * trpc.dailyRecap.submitReply mutation, which calls the same parsing path
 * as the webhook — bypassing Gmail entirely.
 *
 * The card stays empty (and silent) once there are no pending recaps.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function RecapReplyInboxCard() {
  const utils = trpc.useUtils();
  const { data: pending, isLoading } = trpc.dailyRecap.listPending.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  const submit = trpc.dailyRecap.submitReply.useMutation({
    onSuccess: () => {
      toast.success("Recap recorded — that day's log is now complete.");
      setActiveToken(null);
      setDraft("");
      utils.dailyRecap.listPending.invalidate();
    },
    onError: (err) => {
      toast.error(`Could not save recap: ${err.message ?? "unknown error"}`);
    },
  });

  // Hide entirely while loading or when nothing is pending — the drawer is
  // dense enough without an empty placeholder for every helper.
  if (isLoading) return null;
  if (!pending || pending.length === 0) return null;

  return (
    <Card className="classroom-card p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-display text-sm font-semibold chalk-white">
            📬 Daily recaps still waiting for a reply
          </div>
          <div className="text-xs opacity-70 mt-1">
            {pending.length === 1 ? "1 day" : `${pending.length} days`} need a quick "what happened today" reply so the curriculum tracker can credit the work. The Gmail reply path isn't landing — answer here instead.
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {pending.map(req => (
          <li key={req.token} className="rounded-lg border border-border/50 bg-background/40 p-2">
            {activeToken === req.token ? (
              <div className="space-y-2">
                <div className="text-sm font-medium chalk-white">{formatDate(req.dateISO)}</div>
                <Textarea
                  rows={4}
                  className="text-sm"
                  placeholder='e.g. "Did 30 min of multiplication, finished Tuck Everlasting chapter 5, went to the park for nature journaling."'
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setActiveToken(null); setDraft(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => submit.mutate({ token: req.token, replyText: draft })}
                    disabled={submit.isPending || draft.trim().length < 2}
                  >
                    {submit.isPending ? "Saving…" : "Save recap"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-sm font-medium chalk-white">{formatDate(req.dateISO)}</div>
                  <div className="text-xs opacity-60">Sent to {req.sentTo}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => { setActiveToken(req.token); setDraft(""); }}
                >
                  Answer
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
