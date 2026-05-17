/**
 * FreeFormPromptPanel — v2.16 (2026-05-17)
 *
 * Adult-only AgendaEditor sub-panel that wraps the new
 * `plans.aiPropose` + `plans.aiApplyProposal` flow:
 *
 *   1. Mom or Grandma types a free-form instruction ("swap math to 9:30",
 *      "shorten reading to 20 min", "add a nature walk after lunch").
 *   2. Hits Propose → `plans.aiPropose` returns a Proposal with one
 *      decision per existing block + any add-decisions for new blocks.
 *   3. The panel renders one DiffCard per decision: keep / modify /
 *      remove / add. Each card has an Accept checkbox (defaulting to ON
 *      for keep/modify/remove/add) so Mom can selectively reject any
 *      decision before commit.
 *   4. Hits Apply N changes → `plans.aiApplyProposal` runs the accepted
 *      decisions in `removes → modifies → adds` order. Result is
 *      partial-apply: the response includes a per-decision results array,
 *      and the panel surfaces any failures by row.
 *
 * Complements the existing `agendaEditor.preview` / `commit` flow on the
 * same page — that one applies a wholesale diff. This one gives Mom a
 * per-decision Accept/Reject workflow so she can keep most of the AI's
 * proposal but veto one or two items.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type DecisionKeep = { kind: "keep"; existingBlockId: number; reason: string };
type DecisionModify = {
  kind: "modify";
  existingBlockId: number;
  before: AIBlockDraft;
  after: AIBlockDraft;
  reason: string;
};
type DecisionRemove = { kind: "remove"; existingBlockId: number; reason: string };
type DecisionAdd = {
  kind: "add";
  after: AIBlockDraft;
  insertAfterSortOrder: number | null;
  reason: string;
};
type AIBlockDraft = {
  blockType: string;
  title: string;
  description?: string;
  durationMin: number;
  startTime?: string | null;
  subjectSlug?: string | null;
};
type Decision = DecisionKeep | DecisionModify | DecisionRemove | DecisionAdd;

type ProposalResponse = {
  summary: string;
  decisions: Decision[];
  warnings: string[];
  planId?: number;
  existingBlockCount?: number;
};

type ResultRow = {
  kind: "keep" | "modify" | "remove" | "add";
  existingBlockId?: number;
  ok: boolean;
  error?: string;
};

const KIND_BADGE: Record<Decision["kind"], { label: string; cls: string }> = {
  keep: { label: "Keep", cls: "bg-slate-500/15 text-slate-300" },
  modify: { label: "Modify", cls: "bg-amber-500/20 text-amber-300" },
  remove: { label: "Remove", cls: "bg-red-500/20 text-red-300" },
  add: { label: "Add", cls: "bg-emerald-500/20 text-emerald-300" },
};

/** Build a stable per-decision id used for both the React key and the
 *  accept-set lookup. Add decisions don't have an existingBlockId so we
 *  fall back to the array index. */
function decisionKey(d: Decision, idx: number): string {
  if (d.kind === "add") return `add-${idx}`;
  return `${d.kind}-${d.existingBlockId}`;
}

function DraftLine({ d }: { d: AIBlockDraft }) {
  return (
    <div className="text-[11px] opacity-90">
      <span className="font-mono mr-1">{d.startTime ?? "—"}</span>
      <span className="font-medium">{d.title}</span>
      <span className="ml-2 opacity-70">
        · {d.blockType}
        {d.subjectSlug ? ` · ${d.subjectSlug}` : ""}
        {` · ${d.durationMin}m`}
      </span>
    </div>
  );
}

function DiffCard({
  d,
  idx,
  accepted,
  onToggle,
  result,
}: {
  d: Decision;
  idx: number;
  accepted: boolean;
  onToggle: (next: boolean) => void;
  result?: ResultRow;
}) {
  const badge = KIND_BADGE[d.kind];
  const id = decisionKey(d, idx);
  return (
    <div
      className={
        "rounded border px-3 py-2 transition " +
        (result?.ok === false
          ? "border-red-500/60 bg-red-500/10"
          : result?.ok === true
            ? "border-emerald-500/60 bg-emerald-500/10"
            : accepted
              ? "border-border bg-card/40"
              : "border-border/40 bg-muted/30 opacity-70")
      }
      data-testid={`diff-card-${id}`}
    >
      <div className="flex items-center gap-2">
        {/* keep decisions are no-ops on commit; we still expose the toggle
            for transparency but don't gate apply-count on them. */}
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => onToggle(v === true)}
          disabled={d.kind === "keep"}
          data-testid={`diff-card-accept-${id}`}
        />
        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
        {d.kind !== "add" && (
          <span className="text-[10px] opacity-60">block #{d.existingBlockId}</span>
        )}
        {result?.ok === false && (
          <span className="ml-auto text-[10px] text-red-400">failed: {result.error ?? "unknown"}</span>
        )}
        {result?.ok === true && (
          <span className="ml-auto text-[10px] text-emerald-400">applied</span>
        )}
      </div>

      {d.kind === "keep" && (
        <div className="mt-1 text-[11px] opacity-70 italic">{d.reason || "(unchanged)"}</div>
      )}
      {d.kind === "modify" && (
        <div className="mt-1 space-y-1">
          <div className="text-[10px] opacity-60">Before</div>
          <DraftLine d={d.before} />
          <div className="text-[10px] opacity-60 mt-1">After</div>
          <DraftLine d={d.after} />
          {d.reason && <div className="text-[10px] opacity-60 italic mt-1">{d.reason}</div>}
        </div>
      )}
      {d.kind === "remove" && (
        <div className="mt-1 text-[11px] opacity-70 italic">{d.reason || "remove this block"}</div>
      )}
      {d.kind === "add" && (
        <div className="mt-1 space-y-1">
          <DraftLine d={d.after} />
          {d.reason && <div className="text-[10px] opacity-60 italic">{d.reason}</div>}
        </div>
      )}
    </div>
  );
}

export function FreeFormPromptPanel({ date }: { date: string }) {
  const [prompt, setPrompt] = useState<string>("");
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const utils = trpc.useUtils();

  const proposeM = (trpc as any).plans.aiPropose.useMutation({
    onSuccess: (data: ProposalResponse) => {
      setProposal(data);
      // Default-on for actionable decisions; keeps stay neutral.
      const next: Record<string, boolean> = {};
      data.decisions.forEach((d, idx) => {
        const id = decisionKey(d, idx);
        next[id] = d.kind !== "keep";
      });
      setAccepted(next);
      setResults(null);
      if (data.decisions.length === 0) {
        toast.message(data.summary || "No decisions returned.");
      }
      if (data.warnings?.length) {
        toast.warning(data.warnings.join("; "));
      }
    },
    onError: (e: any) => toast.error("Propose failed: " + (e?.message ?? "unknown")),
  });

  const applyM = (trpc as any).plans.aiApplyProposal.useMutation({
    onSuccess: async (data: any) => {
      const arr: ResultRow[] = data?.results ?? [];
      setResults(arr);
      const failures = arr.filter((r) => !r.ok);
      if (failures.length === 0) {
        toast.success(
          `Applied: +${data?.added ?? 0} ~${data?.modified ?? 0} -${data?.removed ?? 0}`
        );
      } else {
        toast.warning(
          `Partial apply: ${arr.length - failures.length} succeeded, ${failures.length} failed`
        );
      }
      await utils.agendaEditor.snapshot.invalidate({ date });
      await utils.plans.byDate.invalidate?.();
      await utils.plans.today.invalidate?.();
    },
    onError: (e: any) => toast.error("Apply failed: " + (e?.message ?? "unknown")),
  });

  const decisions = proposal?.decisions ?? [];

  /** The decisions Mom actually wants to commit, in proposal order.
   *  `keep` decisions are filtered out (server treats them as no-ops). */
  const acceptedDecisions = useMemo(() => {
    return decisions
      .map((d, idx) => ({ d, idx }))
      .filter(({ d, idx }) => d.kind !== "keep" && accepted[decisionKey(d, idx)])
      .map(({ d }) => d);
  }, [decisions, accepted]);

  const onPropose = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("Type a prompt first.");
      return;
    }
    proposeM.mutate({ date, adultPrompt: trimmed });
  };

  const onApply = () => {
    if (acceptedDecisions.length === 0) {
      toast.error("Accept at least one decision first.");
      return;
    }
    applyM.mutate({ date, decisions: acceptedDecisions });
  };

  const onClear = () => {
    setProposal(null);
    setAccepted({});
    setResults(null);
    setPrompt("");
  };

  return (
    <Card className="border-violet-500/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <span aria-hidden>✨</span>
          Free-form prompt (per-decision)
          <span className="text-xs font-normal opacity-60">v2.16</span>
        </CardTitle>
        <p className="text-sm opacity-70 mt-1">
          Like the AI box above, but lets you accept or reject the AI's proposal
          one block at a time. Useful when you like most of what the AI suggests
          and want to veto just one or two changes.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder='e.g. "shorten reading to 20 min and swap the 10:00 block to a nature walk"'
          data-testid="freeform-prompt-textarea"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs opacity-60">
            Date: <span className="font-mono">{date}</span>
            {proposal && (
              <span className="ml-2">
                · {decisions.length} decision{decisions.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {proposal && (
              <Button variant="ghost" onClick={onClear} disabled={proposeM.isPending || applyM.isPending}>
                Discard
              </Button>
            )}
            <Button
              onClick={onPropose}
              disabled={proposeM.isPending || !prompt.trim()}
              data-testid="freeform-propose-button"
            >
              {proposeM.isPending ? "Thinking…" : "Propose →"}
            </Button>
          </div>
        </div>

        {proposal?.summary && (
          <div className="rounded border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs">
            <div className="font-medium opacity-90">Summary</div>
            <div className="opacity-80 mt-1">{proposal.summary}</div>
          </div>
        )}

        {proposal?.warnings && proposal.warnings.length > 0 && (
          <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs space-y-1">
            {proposal.warnings.map((w, i) => (
              <div key={i}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {decisions.length > 0 && (
          <div className="space-y-2">
            {decisions.map((d, idx) => {
              const id = decisionKey(d, idx);
              const result = results?.find((r) =>
                d.kind === "add"
                  ? r.kind === "add" && !r.existingBlockId
                  : r.kind === d.kind && r.existingBlockId === (d as any).existingBlockId
              );
              return (
                <DiffCard
                  key={id}
                  d={d}
                  idx={idx}
                  accepted={!!accepted[id]}
                  onToggle={(next) => setAccepted((prev) => ({ ...prev, [id]: next }))}
                  result={result}
                />
              );
            })}
          </div>
        )}

        {decisions.length > 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={onApply}
              disabled={applyM.isPending || acceptedDecisions.length === 0}
              data-testid="freeform-apply-button"
            >
              {applyM.isPending
                ? "Applying…"
                : `Apply ${acceptedDecisions.length} change${acceptedDecisions.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FreeFormPromptPanel;
