/**
 * Push 91 (2026-05-13) — Approvals admin card.
 *
 * Surfaces:
 *   - The current pending-approval queue (kind + summary + AI reason +
 *     who requested it + age in hours). Each row has Approve / Reject
 *     buttons that hit `approvals.resolve`.
 *   - The active push-target roster (Mom + Grandma + active tutors).
 *
 * Mom + Grandma are family admins and per the never-queued rule their
 * OWN actions never land here — this card is for tutor or system
 * requests that the AI flagged as `needs_review`. The card self-hides
 * when there's nothing pending AND no push targets configured (no info
 * → render nothing).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function ageHours(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}m`;
  const hrs = Math.round(min / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default function ApprovalsAdminCard() {
  const utils = trpc.useUtils();
  const pendingQ = (trpc as any).approvals?.listPending?.useQuery?.(
    { limit: 50 },
    { staleTime: 30_000 },
  );
  const targetsQ = (trpc as any).rosterOverride?.pushTargets?.useQuery?.(
    undefined,
    { staleTime: 60_000 },
  );

  const resolve = (trpc as any).approvals?.resolve?.useMutation?.({
    onSuccess: () => {
      (utils as any).approvals?.listPending?.invalidate?.();
      toast.success("Decision recorded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record decision"),
  });

  const pending = (pendingQ?.data ?? []) as Array<{
    id: number;
    kind: string;
    summary: string;
    requestedBy: string;
    requestedAt: number;
    aiDecision: string | null;
    aiReason: string | null;
  }>;
  const targets = (targetsQ?.data ?? []) as Array<{
    id: number;
    displayName: string;
    role: string;
    phoneE164: string | null;
    isActive: boolean;
  }>;

  // Self-hide: no info → render nothing.
  if (pending.length === 0 && targets.length === 0) return null;

  return (
    <Card className="classroom-card" data-testid="approvals-admin-card">
      <CardHeader>
        <CardTitle>Approvals queue</CardTitle>
        <p className="text-xs opacity-70">
          Tutor / system requests that need a Mom or Grandma decision. Mom and
          Grandma's own changes never land here — they auto-approve.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length === 0 ? (
          <div className="text-sm opacity-70">No pending requests. All clear.</div>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-white/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`approval-row-${p.id}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    <span className="opacity-70 mr-2">[{p.kind}]</span>
                    {p.summary}
                  </div>
                  <div className="text-[11px] opacity-70 mt-1">
                    {p.requestedBy} · {ageHours(p.requestedAt)}
                    {p.aiReason ? ` · AI: ${p.aiReason}` : ""}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() =>
                      resolve?.mutate?.({ id: p.id, status: "approved" })
                    }
                    disabled={resolve?.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolve?.mutate?.({ id: p.id, status: "rejected" })
                    }
                    disabled={resolve?.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {targets.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-2">
              Active push recipients
            </div>
            <ul className="text-sm space-y-1">
              {targets.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="font-medium">{t.displayName}</span>
                  <span className="text-xs opacity-60">({t.role})</span>
                  {t.phoneE164 ? (
                    <span className="text-xs opacity-60">
                      · {t.phoneE164}
                    </span>
                  ) : (
                    <span className="text-xs opacity-50 italic">
                      · no phone on file
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
