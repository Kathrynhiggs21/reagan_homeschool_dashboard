/**
 * v2.14 (2026-05-17) — Adult quick-entry "What we actually did" card on Today.
 *
 * Mom or Grandma types ONE plain-English line per block (e.g.,
 *   "Math: workbook page 42, took 25 min, did great"
 *   "Reading: Michael's World ch.4, 20 min"
 *   "PE: walked the dog, 15 min")
 *
 * The card calls the existing `applyAdultQuickEntry` mutation (Push 159,
 * familyAdmin, parse-only) to preview a typed entry per line — subject,
 * minutes, outcome, friendly headline. Mom can then accept-or-reject each
 * line and tap **Save** to actually persist via `actuals.add` per
 * accepted row. Each `actuals.add` triggers a Drive day-log rebuild
 * automatically (see server/db.ts recordActualEntry → enqueueDayLogRebuildForDate).
 *
 * Adult-only — must be wrapped in `{unlocked && ...}` at the mount site.
 * Defense-in-depth: both procs are familyAdminProcedure; even if the lock
 * leaks, the kid client gets a 401.
 *
 * Design rules (from House Rules):
 *  - "Don't show if no info" → after a successful save, the parsed-preview
 *    block collapses and only the Saved-N-entries summary stays.
 *  - No grey boxes — empty state uses the dashed-card outline pattern from
 *    other Today widgets.
 *  - No emoji except where the existing design language already uses them.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ParsedEntry = {
  schoolDayISO: string;
  plannedBlockId?: string;
  subject: string;
  rawLine: string;
  minutesSpent: number;
  outcome: "great" | "okay" | "hard" | "skipped" | "unspecified";
  displayLabel: string;
  whatTheyDid: string;
};

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SUBJECT_TO_VALID_SLUG: Record<string, string> = {
  math: "math",
  reading: "reading",
  writing: "writing",
  science: "science",
  social_studies: "social",
  art: "art",
  music: "music",
  pe: "pe",
  outdoor_adventure: "outdoor",
  unspecified: "other",
};

export default function TodayAdultQuickEntryCard() {
  const [draft, setDraft] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState<number>(0);

  const utils = trpc.useUtils?.();
  const parseMut = trpc.today.applyAdultQuickEntry.useMutation();
  const addMut = trpc.actuals.quickAdd.useMutation();

  const dateISO = todayISO();

  function startReview() {
    const lines = draft
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (lines.length === 0) {
      toast.error("Add at least one line first.");
      return;
    }
    parseMut.mutate(
      { schoolDayISO: dateISO, lines: lines.map((l) => ({ rawLine: l })) },
      {
        onSuccess: (payload: any) => {
          const entries = (payload?.actualEntries ?? []) as ParsedEntry[];
          setParsed(entries);
          // Default to all-accepted; Mom can untoggle the bad ones.
          setAccepted(new Set(entries.map((_, i) => i)));
        },
        onError: (e: any) => toast.error(e?.message ?? "Could not parse."),
      },
    );
  }

  function toggleAccept(i: number) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveAccepted() {
    if (!parsed) return;
    const toSave = parsed.filter((_, i) => accepted.has(i));
    if (toSave.length === 0) {
      toast.error("Nothing accepted to save.");
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const e of toSave) {
      try {
        await addMut.mutateAsync({
          dateISO: e.schoolDayISO,
          plannedBlockId: e.plannedBlockId
            ? Number(e.plannedBlockId)
            : undefined,
          subjectSlug: SUBJECT_TO_VALID_SLUG[e.subject] ?? "other",
          topic: e.whatTheyDid || e.displayLabel,
          minutesSpent: e.minutesSpent,
          source: "mom-input",
          notes: e.rawLine,
        } as any);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setSavedCount((prev) => prev + ok);
    setParsed(null);
    setAccepted(new Set());
    setDraft("");
    if (ok > 0) toast.success(`Saved ${ok} ${ok === 1 ? "entry" : "entries"}.`);
    if (failed > 0) toast.error(`${failed} did not save.`);
    // Refresh dependent reads if utils is available.
    try {
      utils?.actuals?.listForDate?.invalidate({ dateISO });
      utils?.actuals?.vsPlanned?.invalidate({ dateISO });
    } catch {
      /* utils may be undefined in older React Query versions */
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">
          What we actually did today
          {savedCount > 0 ? (
            <Badge className="ml-2" variant="secondary">
              {savedCount} saved
            </Badge>
          ) : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          One line per block. e.g.{" "}
          <code>Math: workbook page 42, 25 min, did great</code>. Mom + Grandma only.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {parsed === null ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"Math: workbook page 42, 25 min, did great\nReading: Michael's World ch.4, 20 min\nPE: walked the dog, 15 min"}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={startReview}
                disabled={parseMut.isPending || !draft.trim()}
              >
                {parseMut.isPending ? "Parsing…" : "Review parsed entries"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {parsed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing parsed. Try rephrasing with a subject prefix.
                </p>
              ) : (
                parsed.map((e, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-2 flex items-start gap-2 ${
                      accepted.has(i) ? "" : "opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={accepted.has(i)}
                      onChange={() => toggleAccept(i)}
                      className="mt-1"
                      aria-label={`accept ${e.displayLabel}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{e.displayLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {e.whatTheyDid || <em>(no detail)</em>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Original: <code>{e.rawLine}</code>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setParsed(null);
                  setAccepted(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={saveAccepted}
                disabled={addMut.isPending || accepted.size === 0}
              >
                {addMut.isPending
                  ? "Saving…"
                  : `Save ${accepted.size} ${accepted.size === 1 ? "entry" : "entries"}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
