/**
 * Approvals admin card.
 *
 * v3.16 (2026-05-30) — split into two sub-tabs per todo:
 *   1. "Needs your review"  — pending rows; Approve / Reject buttons
 *   2. "AI auto-approved (24h)" — visibility-only feed of rows the AI
 *      auto-approved overnight (no buttons; this is just for awareness).
 *
 * Mom + Grandma's own actions never enter the queue — that's enforced
 * server-side in `approvals.submit`. This card surfaces tutor / system /
 * AI requests only.
 *
 * Self-hides when both tabs are empty AND no push targets are configured
 * (no info → render nothing).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type ApprovalRow = {
  id: number;
  kind: string;
  summary: string;
  requestedBy: string;
  requestedAt: number;
  aiDecision: string | null;
  aiReason: string | null;
};

export default function ApprovalsAdminCard() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"review" | "auto">("review");

  const pendingQ = (trpc as any).approvals?.listPending?.useQuery?.(
    { limit: 50 },
    { staleTime: 30_000 },
  );
  const autoQ = (trpc as any).approvals?.listAutoApprovedRecent?.useQuery?.(
    { hours: 24, limit: 100 },
    { staleTime: 30_000 },
  );
  const targetsQ = (trpc as any).rosterOverride?.pushTargets?.useQuery?.(
    undefined,
    { staleTime: 60_000 },
  );

  const resolve = (trpc as any).approvals?.resolve?.useMutation?.({
    onSuccess: () => {
      (utils as any).approvals?.listPending?.invalidate?.();
      (utils as any).approvals?.listAutoApprovedRecent?.invalidate?.();
      toast.success("Decision recorded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record decision"),
  });

  const pending = (pendingQ?.data ?? []) as ApprovalRow[];
  const auto = (autoQ?.data ?? []) as ApprovalRow[];
  const targets = (targetsQ?.data ?? []) as Array<{
    id: number;
    displayName: string;
    role: string;
    phoneE164: string | null;
    isActive: boolean;
  }>;

  // Self-hide: nothing to show in either tab AND no push targets.
  if (pending.length === 0 && auto.length === 0 && targets.length === 0) return null;

  return (
    <Card className="classroom-card" data-testid="approvals-admin-card">
      <CardHeader>
        <CardTitle>Approvals queue</CardTitle>
        <p className="text-xs opacity-70">
          Tutor / system / AI requests. Mom &amp; Grandma's own changes never
          land here — they auto-approve.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "review" | "auto")}>
          <TabsList>
            <TabsTrigger value="review" data-testid="tab-needs-review">
              Needs your review
              {pending.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="auto" data-testid="tab-auto-approved">
              AI auto-approved (24h)
              {auto.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {auto.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            {pending.length === 0 ? (
              <div className="text-sm opacity-70 py-3">
                No pending requests. All clear.
              </div>
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
          </TabsContent>

          <TabsContent value="auto">
            {auto.length === 0 ? (
              <div className="text-sm opacity-70 py-3">
                Nothing the AI auto-approved in the last 24 hours.
              </div>
            ) : (
              <ul className="space-y-2">
                {auto.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-white/10 p-3"
                    data-testid={`auto-approved-row-${p.id}`}
                  >
                    <div className="text-sm font-semibold truncate">
                      <span className="opacity-70 mr-2">[{p.kind}]</span>
                      {p.summary}
                    </div>
                    <div className="text-[11px] opacity-70 mt-1">
                      {p.requestedBy} · {ageHours(p.requestedAt)}
                      {p.aiReason ? ` · AI: ${p.aiReason}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] opacity-50 mt-3">
              These are visibility-only — the AI applied them without asking.
              If anything looks wrong, you can fix it directly in the agenda
              editor.
            </p>
          </TabsContent>
        </Tabs>

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
                    <span className="text-xs opacity-60">· {t.phoneE164}</span>
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
