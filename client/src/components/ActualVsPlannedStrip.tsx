/**
 * ActualVsPlannedStrip — v2.24 (2026-05-17)
 *
 * Surfaces the existing `actuals.vsPlanned` tRPC payload (already wired
 * server-side since Push 40) as a per-block "actual vs planned" strip.
 *
 * Why this matters: `actualAgendaEntries` rows are written by the
 * adult quick-entry card, the Reagan check-in flow, the Grandma recap
 * email reply parser, and (someday) Kiwi-listened classification. But
 * until v2.24 there was no per-block surface that let Mom or Grandma
 * see at-a-glance which planned blocks actually got covered today.
 *
 * Design intent:
 *   - Adult-facing (familyAdminProcedure-gated quickAdd action).
 *     Reagan does not need to see the planned-vs-actual delta.
 *   - One row per planned block:
 *       - "✓ Math: long division (32m)"  ← actual entry exists, pinned
 *       - "○ Adventure block — not logged yet"  ← no actual yet, with
 *         a one-tap quickAdd inline (subject + topic + minutes)
 *   - Off-plan section beneath: anything Reagan did that wasn't on the
 *     plan (museum walk, baking, pet care). These already exist in the
 *     `actualAgendaEntries` table with plannedBlockId=NULL.
 *   - Loading: small skeleton; Empty: "No plan yet for today" message;
 *     Error: red role=alert.
 *   - No optimistic update on quickAdd — we wait for the success and
 *     refetch the strip so the chip moves from "○ not logged" to "✓".
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Props {
  /** ISO date string (YYYY-MM-DD). Defaults to local-today if omitted. */
  dateISO?: string;
  /** Optional className passthrough so callers control spacing. */
  className?: string;
}

function todayIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Small lookup of valid subject slugs we expose in the quick form. */
const SUBJECT_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "math", label: "Math" },
  { slug: "ela", label: "Reading / ELA" },
  { slug: "science", label: "Science" },
  { slug: "social", label: "Social Studies" },
  { slug: "art", label: "Art" },
  { slug: "music", label: "Music" },
  { slug: "pe", label: "PE / Movement" },
  { slug: "outdoor", label: "Outdoor / Adventure" },
  { slug: "animal-care", label: "Animal Care" },
  { slug: "choice", label: "Choice / Free Play" },
  { slug: "other", label: "Other" },
];

interface InlineQuickAddProps {
  blockId: number;
  blockTitle: string;
  defaultSubjectSlug?: string;
  onDone: () => void;
}

function InlineQuickAdd({
  blockId,
  blockTitle,
  defaultSubjectSlug,
  onDone,
}: InlineQuickAddProps) {
  const [topic, setTopic] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("");
  const [subject, setSubject] = useState<string>(
    defaultSubjectSlug ?? "other",
  );
  const utils = trpc.useUtils();
  const dateISO = todayIso();

  const quickAddMut = trpc.actuals.quickAdd.useMutation({
    onSuccess: async () => {
      // Re-fetch the strip — chip flips from "○" to "✓".
      await utils.actuals.vsPlanned.invalidate({ dateISO });
      onDone();
    },
  });

  const submit = () => {
    const m = Number(minutes);
    if (!topic.trim()) return;
    if (!Number.isFinite(m) || m <= 0) return;
    quickAddMut.mutate({
      dateISO,
      subjectSlug: subject,
      topic: topic.trim().slice(0, 240),
      minutesSpent: Math.min(Math.max(Math.round(m), 1), 600),
      plannedBlockId: blockId,
    });
  };

  return (
    <div
      data-testid={`avp-quickadd-${blockId}`}
      className="flex flex-wrap items-center gap-2 mt-2 p-2 rounded-lg bg-muted/30 border"
    >
      <span className="text-xs text-muted-foreground italic shrink-0">
        Log actual for "{blockTitle}":
      </span>
      <Select value={subject} onValueChange={setSubject}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUBJECT_OPTIONS.map((s) => (
            <SelectItem key={s.slug} value={s.slug}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 w-48"
        placeholder="What was the topic?"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        maxLength={240}
      />
      <Input
        className="h-8 w-24"
        placeholder="Minutes"
        type="number"
        min={1}
        max={600}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={
          quickAddMut.isPending ||
          !topic.trim() ||
          !minutes ||
          Number(minutes) <= 0
        }
      >
        {quickAddMut.isPending ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {quickAddMut.error && (
        <div role="alert" className="text-xs text-red-600 w-full">
          {quickAddMut.error.message}
        </div>
      )}
    </div>
  );
}

export function ActualVsPlannedStrip({ dateISO, className }: Props) {
  const date = dateISO ?? todayIso();
  const vsPlannedQ = trpc.actuals.vsPlanned.useQuery({ dateISO: date });
  const [quickAddBlockId, setQuickAddBlockId] = useState<number | null>(null);

  const data = vsPlannedQ.data;

  const totals = useMemo(() => {
    if (!data) return null;
    const planned = data.blocks.length;
    const covered = data.blocks.filter((b) => b.actuals.length > 0).length;
    const offPlan = data.offPlanActuals.length;
    return { planned, covered, offPlan };
  }, [data]);

  if (vsPlannedQ.isLoading) {
    return (
      <Card
        className={"p-3 text-sm text-muted-foreground italic " + (className ?? "")}
        data-testid="avp-loading"
      >
        Loading what got covered today…
      </Card>
    );
  }

  if (vsPlannedQ.isError) {
    return (
      <Card
        className={
          "p-3 text-sm text-red-700 bg-red-50 border-red-200 " + (className ?? "")
        }
        role="alert"
        data-testid="avp-error"
      >
        Couldn't load actuals: {vsPlannedQ.error?.message ?? "unknown error"}
      </Card>
    );
  }

  if (!data || (data.blocks.length === 0 && data.offPlanActuals.length === 0)) {
    return (
      <Card
        className={"p-3 text-sm text-muted-foreground italic " + (className ?? "")}
        data-testid="avp-empty"
      >
        No plan or actuals yet for {date}.
      </Card>
    );
  }

  return (
    <Card
      className={"p-4 space-y-3 " + (className ?? "")}
      data-testid="actual-vs-planned-strip"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="font-display font-semibold text-base">
          Actual vs Planned
        </div>
        {totals && (
          <div className="text-xs text-muted-foreground">
            {totals.covered} of {totals.planned} planned blocks logged · {totals.offPlan} off-plan
          </div>
        )}
      </div>

      {/* Planned-block rows */}
      {data.blocks.length > 0 ? (
        <ul className="space-y-1.5">
          {data.blocks.map((b) => {
            const actual = b.actuals[0];
            const hasActual = !!actual;
            return (
              <li
                key={b.id}
                data-testid={`avp-block-${b.id}`}
                className={
                  "rounded-lg px-3 py-2 text-sm flex flex-col gap-1 " +
                  (hasActual
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                    : "bg-muted/40 border border-border text-foreground")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span aria-hidden className="shrink-0">
                      {hasActual ? "✓" : "○"}
                    </span>
                    <span className="font-medium truncate">{b.title}</span>
                    {hasActual && (
                      <span className="text-xs opacity-80 truncate">
                        — {actual.topic} ({actual.minutesSpent}m
                        {actual.pinned ? "" : ", matched"})
                      </span>
                    )}
                  </div>
                  {!hasActual && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setQuickAddBlockId(quickAddBlockId === b.id ? null : b.id)
                      }
                      data-testid={`avp-block-${b.id}-log-btn`}
                    >
                      {quickAddBlockId === b.id ? "Close" : "Log it"}
                    </Button>
                  )}
                </div>
                {!hasActual && quickAddBlockId === b.id && (
                  <InlineQuickAdd
                    blockId={b.id}
                    blockTitle={b.title}
                    defaultSubjectSlug={b.subjectSlug ?? undefined}
                    onDone={() => setQuickAddBlockId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          No planned blocks for {date}.
        </div>
      )}

      {/* Off-plan rows */}
      {data.offPlanActuals.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Off-plan
          </div>
          <ul className="space-y-1">
            {data.offPlanActuals.map((a) => (
              <li
                key={a.id}
                data-testid={`avp-offplan-${a.id}`}
                className="rounded-lg px-3 py-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-900"
              >
                ★ <span className="font-medium">{a.topic}</span>{" "}
                <span className="opacity-80 text-xs">
                  ({a.subjectSlug}, {a.minutesSpent}m)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default ActualVsPlannedStrip;
