/**
 * RunbooksAdminCard — surfaces the user-action runbooks (Resend custom
 * domain verification, SKILL.md 6th-grade update, etc.) inside the adult
 * Settings panel so blocked items are self-documenting.
 *
 * v3.19 (2026-05-30) — initial card.
 *
 * Backed by `trpc.runbooks.list` + `trpc.runbooks.get` (admin-only).
 * Renders the body via `Streamdown` for proper Markdown formatting.
 * Self-hides if the registry is empty (so the card never sticks around
 * once every runbook has been completed and dropped from the registry).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

type RunbookSummary = {
  slug: string;
  title: string;
  category: string;
  oneLineSummary: string;
  estimatedMinutes: number;
  lastUpdatedISO: string;
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

  const listQ = (trpc as any).runbooks?.list?.useQuery?.(undefined, {
    staleTime: 5 * 60_000,
  });

  const getQ = (trpc as any).runbooks?.get?.useQuery?.(
    openSlug ? { slug: openSlug } : ({} as any),
    { enabled: !!openSlug, staleTime: 5 * 60_000 },
  );

  // Self-hide if the registry is empty or the procedure isn't wired
  if (!listQ) return null;
  if (listQ.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Runbooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading runbooks…</p>
        </CardContent>
      </Card>
    );
  }
  const runbooks: RunbookSummary[] = listQ.data ?? [];
  if (runbooks.length === 0) return null;

  const openRunbook = openSlug
    ? (getQ?.data as
        | (RunbookSummary & { body: string })
        | undefined)
    : undefined;

  return (
    <Card data-testid="runbooks-admin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Runbooks</span>
          <Badge variant="secondary" className="text-xs">
            {runbooks.length}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Step-by-step guides for the {runbooks.length} blocked or
          user-action items that need a non-coding action. Each one stays
          here until completed.
        </p>
      </CardHeader>
      <CardContent>
        {!openSlug && (
          <ul className="space-y-3" data-testid="runbooks-list">
            {runbooks.map((rb) => (
              <li
                key={rb.slug}
                className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
                data-runbook-slug={rb.slug}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-stone-900 leading-snug">
                    {rb.title}
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">
                    Updated {rb.lastUpdatedISO}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenSlug(rb.slug)}
                    data-testid={`runbook-open-${rb.slug}`}
                  >
                    Open runbook →
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
              <div className="prose prose-stone prose-sm max-w-none">
                <Streamdown>{openRunbook.body}</Streamdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
