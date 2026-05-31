/**
 * RunbooksAdminCard — surfaces the user-action runbooks (Resend custom
 * domain verification, SKILL.md 6th-grade update, Google Drive OAuth
 * setup, etc.) inside the adult Settings panel so blocked items are
 * self-documenting.
 *
 * v3.19 (2026-05-30) — initial card.
 * v3.20 (2026-05-31) — per-runbook dismiss + undismiss + "show dismissed"
 *                       toggle. Section id `runbooks-admin-card` so the
 *                       Settings header badge can smooth-scroll to it.
 *
 * Backed by `trpc.runbooks.list` + `trpc.runbooks.get` (admin-only).
 * Dismiss / undismiss go through `trpc.runbooks.dismiss` /
 * `trpc.runbooks.undismiss` (admin-only mutations). Renders the body via
 * `Streamdown` for proper Markdown formatting. Self-hides if the registry
 * is empty (so the card never sticks around once every runbook has been
 * completed and dropped from the registry).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

type RunbookSummary = {
  slug: string;
  title: string;
  category: string;
  oneLineSummary: string;
  estimatedMinutes: number;
  lastUpdatedISO: string;
  dismissed: boolean;
  dismissedAtISO: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  email: "Email",
  drive: "Google Drive",
  calendar: "Google Calendar",
  skills: "Manus Skills",
  other: "Other",
};

const CATEGORY_TONE: Record<string, string> = {
  email: "bg-rose-100 text-rose-900 border-rose-300",
  drive: "bg-sky-100 text-sky-900 border-sky-300",
  calendar: "bg-violet-100 text-violet-900 border-violet-300",
  skills: "bg-amber-100 text-amber-900 border-amber-300",
  other: "bg-stone-100 text-stone-900 border-stone-300",
};

export default function RunbooksAdminCard() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const listQ = (trpc as any).runbooks?.list?.useQuery?.(undefined, {
    staleTime: 5 * 60_000,
  });

  const getQ = (trpc as any).runbooks?.get?.useQuery?.(
    openSlug ? { slug: openSlug } : ({} as any),
    { enabled: !!openSlug, staleTime: 5 * 60_000 },
  );

  const utils = trpc.useUtils() as any;
  const invalidateList = () => utils?.runbooks?.list?.invalidate?.();

  const dismissM = (trpc as any).runbooks?.dismiss?.useMutation?.({
    onSuccess: (_d: any, vars: any) => {
      toast.success(`Dismissed: ${vars?.slug ?? "runbook"}`);
      invalidateList();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not dismiss runbook."),
  });

  const undismissM = (trpc as any).runbooks?.undismiss?.useMutation?.({
    onSuccess: (_d: any, vars: any) => {
      toast.success(`Restored: ${vars?.slug ?? "runbook"}`);
      invalidateList();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not restore runbook."),
  });

  // Self-hide if the registry is empty or the procedure isn't wired
  if (!listQ) return null;
  if (listQ.isLoading) {
    return (
      <Card id="runbooks-admin-card">
        <CardHeader>
          <CardTitle>Runbooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading runbooks…</p>
        </CardContent>
      </Card>
    );
  }
  const allRunbooks: RunbookSummary[] = listQ.data ?? [];
  if (allRunbooks.length === 0) return null;

  const activeRunbooks = allRunbooks.filter((r) => !r.dismissed);
  const dismissedRunbooks = allRunbooks.filter((r) => r.dismissed);
  const runbooks = showDismissed ? dismissedRunbooks : activeRunbooks;

  // Even if the registry is non-empty, if every runbook has been dismissed
  // AND the user is currently looking at the active list, surface a tiny
  // "all clear" state with a one-click "show dismissed" affordance. Don't
  // disappear entirely (so the user can still undismiss).
  const everythingDismissed =
    activeRunbooks.length === 0 && dismissedRunbooks.length > 0;

  const openRunbook = openSlug
    ? (getQ?.data as
        | (RunbookSummary & { body: string })
        | undefined)
    : undefined;

  return (
    <Card data-testid="runbooks-admin-card" id="runbooks-admin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Runbooks</span>
          <Badge variant="secondary" className="text-xs" data-testid="runbooks-count-badge">
            {activeRunbooks.length}
          </Badge>
          {dismissedRunbooks.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {dismissedRunbooks.length} dismissed
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {activeRunbooks.length > 0
              ? `Step-by-step guides for the ${activeRunbooks.length} blocked or user-action item${activeRunbooks.length === 1 ? "" : "s"} that need a non-coding action. Each one stays here until completed.`
              : "All runbooks have been dismissed. Toggle below to review them."}
          </p>
          {dismissedRunbooks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpenSlug(null);
                setShowDismissed((v) => !v);
              }}
              data-testid="runbooks-show-dismissed-toggle"
            >
              {showDismissed
                ? `← Back to active (${activeRunbooks.length})`
                : `Show dismissed (${dismissedRunbooks.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!openSlug && (
          <>
            {runbooks.length === 0 && !everythingDismissed && (
              <p className="text-sm text-muted-foreground">
                Nothing to show in this view.
              </p>
            )}
            <ul className="space-y-3" data-testid="runbooks-list">
              {runbooks.map((rb) => (
                <li
                  key={rb.slug}
                  className={`rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow ${
                    rb.dismissed
                      ? "border-stone-200 bg-stone-50 opacity-80"
                      : "border-stone-200 bg-white"
                  }`}
                  data-runbook-slug={rb.slug}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-stone-900 leading-snug flex items-center gap-2">
                      {rb.title}
                      {rb.dismissed && (
                        <Badge variant="outline" className="text-[10px]">
                          Dismissed
                        </Badge>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          CATEGORY_TONE[rb.category] ?? CATEGORY_TONE.other
                        }`}
                      >
                        {CATEGORY_LABEL[rb.category] ?? rb.category}
                      </span>
                      <span className="text-xs text-stone-500">
                        ~{rb.estimatedMinutes} min
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-stone-700 mb-2">
                    {rb.oneLineSummary}
                  </p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-stone-400">
                      {rb.dismissed && rb.dismissedAtISO
                        ? `Dismissed ${new Date(rb.dismissedAtISO).toLocaleDateString()}`
                        : `Updated ${rb.lastUpdatedISO}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenSlug(rb.slug)}
                        data-testid={`runbook-open-${rb.slug}`}
                      >
                        Open runbook →
                      </Button>
                      {!rb.dismissed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!dismissM || dismissM?.isPending}
                          onClick={() => dismissM?.mutate?.({ slug: rb.slug })}
                          data-testid={`runbook-dismiss-${rb.slug}`}
                        >
                          Dismiss
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!undismissM || undismissM?.isPending}
                          onClick={() => undismissM?.mutate?.({ slug: rb.slug })}
                          data-testid={`runbook-undismiss-${rb.slug}`}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {openSlug && (
          <div data-testid="runbook-detail">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpenSlug(null)}
                data-testid="runbook-back"
              >
                ← Back to list
              </Button>
              {openRunbook?.lastUpdatedISO && (
                <span className="text-xs text-stone-500">
                  Updated {openRunbook.lastUpdatedISO} · ~
                  {openRunbook.estimatedMinutes} min
                </span>
              )}
            </div>
            {getQ?.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading runbook…
              </p>
            )}
            {getQ?.error && (
              <p className="text-sm text-rose-700">
                Could not load runbook: {String(getQ.error.message ?? getQ.error)}
              </p>
            )}
            {openRunbook && (
              <>
                <div className="prose prose-stone prose-sm max-w-none">
                  <Streamdown>{openRunbook.body}</Streamdown>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {!openRunbook.dismissed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!dismissM || dismissM?.isPending}
                      onClick={() => {
                        dismissM?.mutate?.({ slug: openRunbook.slug });
                        setOpenSlug(null);
                      }}
                      data-testid="runbook-detail-dismiss"
                    >
                      Mark done & dismiss
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!undismissM || undismissM?.isPending}
                      onClick={() => {
                        undismissM?.mutate?.({ slug: openRunbook.slug });
                        setOpenSlug(null);
                      }}
                      data-testid="runbook-detail-undismiss"
                    >
                      Restore to active
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
