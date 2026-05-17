/**
 * AgendaEditor — Manus-style natural language schedule editor for adults.
 *
 * Three sections:
 *   1. Chat-style instruction box. Adult types anything ("make it shorter and
 *      fun", "swap 10:30 to a nature walk", "start at 9, end by 1, 25-min
 *      blocks"). Hits Send → backend returns an EditPlan + before/after diff.
 *   2. Diff preview (Before / After columns) with Apply + Undo buttons.
 *   3. Manual block grid: every block's title, type, time, length, subject,
 *      topic editable inline using the widened blocks.update tRPC procedure.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { parseTime12h, formatTime12h } from "@/lib/time12h";
import { useTutorMode } from "@/hooks/useTutorMode";
import { BlockResourcesPanel } from "@/components/BlockResourcesPanel";
import { BlockAdventurePanel } from "@/components/BlockAdventurePanel";
import { BlockPrintablesPanel } from "@/components/BlockPrintablesPanel";
import { FreeFormPromptPanel } from "@/components/FreeFormPromptPanel";

type Snapshot = {
  id: number;
  title: string;
  description: string | null;
  blockType: string;
  startTime: string | null;
  durationMin: number;
  sortOrder: number;
  status: string;
  subjectSlug: string | null;
  curriculumTopicCode: string | null;
};

const BLOCK_TYPES = [
  "morning_warmup", "math", "adventure", "read_aloud",
  "choice", "catch_up", "appointment", "custom",
];

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function diffBlock(b: Snapshot, otherById: Map<number, Snapshot>): "added" | "removed" | "modified" | "same" | "new" {
  if (b.id < 0) return "new";
  const other = otherById.get(b.id);
  if (!other) return "removed";
  const same = (
    b.title === other.title &&
    b.blockType === other.blockType &&
    b.startTime === other.startTime &&
    b.durationMin === other.durationMin &&
    b.subjectSlug === other.subjectSlug &&
    b.curriculumTopicCode === other.curriculumTopicCode &&
    b.sortOrder === other.sortOrder
  );
  return same ? "same" : "modified";
}

function colorFor(kind: string): string {
  switch (kind) {
    case "added":
    case "new":
      return "border-green-500 bg-green-500/10";
    case "removed":
      return "border-red-500 bg-red-500/10 line-through opacity-70";
    case "modified":
      return "border-amber-500 bg-amber-500/10";
    default:
      return "border-border bg-card/40";
  }
}

function BlockLine({ b, kind }: { b: Snapshot; kind: string }) {
  return (
    <div className={`rounded border-l-4 px-3 py-2 text-sm ${colorFor(kind)}`}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs opacity-70">{formatTime12h(b.startTime)}</span>
        <span className="font-medium">{b.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs opacity-80">
        <span>{b.blockType}</span>
        <span>· {b.durationMin}m</span>
        {b.subjectSlug && <span>· {b.subjectSlug}</span>}
        {b.curriculumTopicCode && <span>· {b.curriculumTopicCode}</span>}
      </div>
    </div>
  );
}

export default function AgendaEditor() {
  const [date, setDate] = useState<string>(todayYmd());
  const [instruction, setInstruction] = useState<string>("");
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [beforeBlocks, setBeforeBlocks] = useState<Snapshot[] | null>(null);
  const [afterBlocks, setAfterBlocks] = useState<Snapshot[] | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Snapshot[] | null>(null);

  const utils = trpc.useUtils();
  // Slice 3: clearDay mutation (Design today from blank). Wipes all blocks for
  // the chosen date. Adult/tutor only via adminOrTutorProcedure on the server.
  const clearDayMut = (trpc as any).blocks.clearDay.useMutation({
    onSuccess: async (r: any) => {
      toast.success(`Cleared ${r?.deleted ?? 0} block(s). Build a new day in the AI box, or use '+ Add block'.`);
      await utils.agendaEditor.snapshot.invalidate({ date });
      setEditPlan(null); setBeforeBlocks(null); setAfterBlocks(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Could not clear day");
    },
  });
  const snapQ = trpc.agendaEditor.snapshot.useQuery({ date });

  const previewM = trpc.agendaEditor.preview.useMutation({
    onSuccess: (data: any) => {
      setEditPlan(data.plan);
      setBeforeBlocks(data.before);
      setAfterBlocks(data.after);
      // If the AI returned 0 ops we still want the adult to see SOMETHING
      // so the spinner ending is meaningful (was: "always stays the same").
      const opsCount = data?.plan?.ops?.length ?? 0;
      if (opsCount === 0) {
        const note = data?.plan?.summary || "The AI didn't suggest any changes.";
        const w0 = data?.plan?.warnings?.[0];
        if (w0 === "timeout" || w0 === "upstream-error") {
          toast.error(note);
        } else {
          toast(note);
        }
      }
    },
    onError: (e) => toast.error("Preview failed: " + e.message),
  });

  const commitM = trpc.agendaEditor.commit.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Applied! ${data.updated}upd ${data.inserted}ins ${data.deleted}del`);
      setSavedSnapshot(beforeBlocks);
      setEditPlan(null);
      setAfterBlocks(null);
      setBeforeBlocks(null);
      setInstruction("");
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Apply failed: " + e.message),
  });

  const undoM = trpc.agendaEditor.undo.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Undone — restored ${data.restored} blocks.`);
      setSavedSnapshot(null);
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Undo failed: " + e.message),
  });

  const blockUpdateM = trpc.blocks.update.useMutation({
    onSuccess: () => utils.agendaEditor.snapshot.invalidate({ date }),
    onError: (e) => toast.error("Block update failed: " + e.message),
  });
  const blockDeleteM = trpc.blocks.delete.useMutation({
    onSuccess: () => utils.agendaEditor.snapshot.invalidate({ date }),
  });
  const blockCreateM = trpc.blocks.createForDate.useMutation({
    onSuccess: () => {
      toast.success("Block added — edit it inline below.");
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Add block failed: " + e.message),
  });
  // Adult quick-action: postpone a single block to tomorrow without opening a modal.
  const postponeBlockM = (trpc as any).adultAi?.postponeBlock?.useMutation?.({
    onSuccess: () => { utils.agendaEditor.snapshot.invalidate({ date }); utils.plans.byDate.invalidate(); utils.plans.today.invalidate(); toast.success("Moved to tomorrow."); },
    onError: (e: any) => toast.error(e?.message || "Move failed."),
  });
  const blockReorderM = trpc.blocks.reorder.useMutation({
    onSuccess: () => utils.agendaEditor.snapshot.invalidate({ date }),
    onError: (e) => toast.error("Reorder failed: " + e.message),
  });
  // Push 19 (2026-05-12) — Tutor convenience: direct "copy from another
  // day" mutation. Used by the two canned buttons below; bypasses the
  // LLM for an instant, lossless copy of every block field.
  const copyFromDateM = (trpc as any).blocks?.copyFromDate?.useMutation?.({
    onSuccess: (r: any) => {
      if (r?.copied > 0) {
        toast.success(`Copied ${r.copied} block${r.copied === 1 ? "" : "s"} into ${date}.`);
      } else if (r?.reason === "no-source-plan" || r?.reason === "empty-source") {
        toast.info("That source day was empty — nothing to copy. Try a different date or use the AI box.");
      } else if (r?.reason === "same-date") {
        toast.info("Source and target date are the same — nothing to copy.");
      }
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e: any) => toast.error("Copy failed: " + (e?.message || "unknown")),
  });
  // Helper: yesterday in YYYY-MM-DD relative to current `date` field.
  const dateMinusDays = (iso: string, days: number): string => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  // Helper: most recent Monday strictly before the current `date`.
  const lastMondayBefore = (iso: string): string => {
    const d = new Date(iso + "T00:00:00");
    const dow = d.getDay(); // 0=Sun..6=Sat
    // Days back to PREVIOUS Monday: if today is Mon (1), go back 7; otherwise (dow + 6) % 7.
    const back = dow === 1 ? 7 : (dow + 6) % 7;
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const shiftDayM = trpc.blocks.shiftDay.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Shifted ${data.shifted} block${data.shifted === 1 ? "" : "s"}` + (data.skipped ? ` (skipped ${data.skipped})` : ""));
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Shift failed: " + e.message),
  });

  // HTML5 drag-and-drop state for the manual grid
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // Optional file the adult attached to the chat (worksheet, page photo, PDF).
  const [attachment, setAttachment] = useState<{ url: string; mimeType: string; fileName: string } | null>(null);
  const uploadM = trpc.agendaEditor.uploadAttachment.useMutation({
    onError: (e) => toast.error("Upload failed: " + e.message),
  });

  const onPickFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File too large (max 8 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      const stored = await uploadM.mutateAsync({ dataUrl, fileName: file.name });
      setAttachment({ url: (stored as any).url, mimeType: (stored as any).mimeType, fileName: file.name });
      toast.success("Attached: " + file.name);
    };
    reader.readAsDataURL(file);
  };

  const onSend = () => {
    const trimmed = instruction.trim();
    if (!trimmed && !attachment) return;
    previewM.mutate({
      date,
      instruction: trimmed || "Read the attached file and work it into today's plan.",
      attachmentUrl: attachment?.url,
      attachmentMimeType: attachment?.mimeType,
    });
  };

  const onApply = () => {
    if (!editPlan) return;
    commitM.mutate({
      date,
      ops: editPlan.ops,
      summary: editPlan.summary,
    });
  };

  const onUndo = () => {
    if (!savedSnapshot) return;
    undoM.mutate({ date, snapshot: savedSnapshot });
  };

  const beforeById = useMemo(() => {
    const m = new Map<number, Snapshot>();
    (beforeBlocks ?? []).forEach(b => m.set(b.id, b));
    return m;
  }, [beforeBlocks]);
  const afterById = useMemo(() => {
    const m = new Map<number, Snapshot>();
    (afterBlocks ?? []).forEach(b => m.set(b.id, b));
    return m;
  }, [afterBlocks]);

  const ctx: any = snapQ.data;
  const liveBlocks: Snapshot[] = ctx?.blocks ?? [];
  const subjects: Array<{ slug: string; name: string }> = ctx?.subjects ?? [];
  const topicCatalog: Array<{ code: string; title: string; subjectSlug: string }> = ctx?.topicCatalog ?? [];

  // 2026-05-12 push 13 — Item L: tutor-of-day strip on the AgendaEditor page,
  // matched to the currently selected date in the date picker. Reads from the
  // public tutors.tutorOfDay procedure (single source of truth, also drives
  // the kid Today page). Falls back to a friendly "Mom-only day" line.
  const tutorOfDayQ = (trpc as any).tutors?.tutorOfDay?.useQuery?.({ dateStr: date }) ?? { data: null };
  const tutorOfDay: { name: string; role: string | null; arrival: string | null; departure: string | null; label: string } | null = tutorOfDayQ.data ?? null;

  // Push 36 (2026-05-13): if Mom flipped on tutor focus mode we show a
  // banner at the top of every adult page so it's obvious the sidebar is
  // intentionally narrowed (and the tutor can ask her to flip it off if
  // they need Settings or Analytics).
  const { enabled: tutorModeOn, setEnabled: setTutorMode } = useTutorMode();
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {tutorModeOn && (
        <div
          className="rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3"
          data-testid="tutor-mode-banner"
        >
          <span>
            <span className="font-semibold">Tutor mode is on.</span>{" "}
            The sidebar is narrowed to Curriculum Hub, Agenda Editor, and Notebook. Analytics and Settings are hidden until Mom flips it off.
          </span>
          <Button size="sm" variant="outline" onClick={() => setTutorMode(false)} className="shrink-0">
            Turn off
          </Button>
        </div>
      )}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Agenda Editor</h1>
          <p className="text-sm opacity-70">Just tell the AI what you want — rearrange, swap topics, change tutors, push the day, anything. It edits the agenda for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {/* Item L — tutor strip beside the date picker so adults always see
              who's slated to be with Reagan on the day they're editing. */}
          <div className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-card/50 dark:bg-card/30 whitespace-nowrap" data-testid="tutor-of-day-strip">
            {tutorOfDay ? (
              <>
                <span className="opacity-60 mr-1">👩‍🏫</span>
                <span className="font-semibold">{tutorOfDay.name}</span>
                {tutorOfDay.role && <span className="opacity-60"> · {tutorOfDay.role}</span>}
                {tutorOfDay.arrival && tutorOfDay.departure && (
                  <span className="opacity-60"> · {tutorOfDay.arrival}–{tutorOfDay.departure}</span>
                )}
              </>
            ) : (
              <span className="opacity-60">👩‍💻 Mom-only day</span>
            )}
          </div>
          {/* Slice 3: Design today from blank — wipes every block on the chosen
              date so the adult/tutor can build it from scratch using the AI box
              or the manual + Add block button. Confirm before destructive action. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-100"
            onClick={async () => {
              const n = liveBlocks.length;
              if (n === 0) {
                toast.info("This day is already blank — use the AI box or '+ Add block' to start building.");
                return;
              }
              if (!confirm(`Clear all ${n} block${n === 1 ? "" : "s"} on ${date} and start from scratch? This can't be undone — but you can re-build with the AI box.`)) return;
              clearDayMut.mutate({ date });
            }}
          >
            Design from blank
          </Button>
        </div>
      </header>

      {/* CHAT INSTRUCTION — the primary surface */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <span aria-hidden>✨</span>
            Tell the AI what to change
          </CardTitle>
          <p className="text-sm opacity-70 mt-1">Plain English. Press Enter or click Send. You’ll see a preview before anything changes.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder='"shorter and fun" • "more math today" • "swap 10:30 to a nature walk" • "start at 9, 25-min blocks" • "Mom can’t tutor today, push to tomorrow" • "add a 20-min read aloud after lunch"'
            rows={4}
            className="text-base"
          />

          {/* 2026-05-05 — Tutor-friendly canned day templates. One click
              fills the instruction box with a full-day prompt so a tutor (or
              Mom on a phone) doesn't have to type or remember syntax. */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300 mb-2">
              Quick day templates
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: "Standard school day", prompt: "Build a standard 4-block school day starting at 9 AM with 25-min blocks: math warm-up, ELA, science, social studies. Add a 10-min snack break between blocks 2 and 3." },
                { label: "Half day (sick / early dismissal)", prompt: "Make today a half day: only the two most important blocks (ELA and math), 20 min each, starting at 9:30 AM. Drop everything else and add a rest block at the end." },
                { label: "Tutor-only day", prompt: "Plan a tutor-only day: tutor arrives at 9 AM, leaves at 1 PM. Build 4 x 30-min blocks back-to-back focused on this week's curriculum, leaving 15 min at the end for tutor handoff notes." },
                { label: "Field trip day", prompt: "Today is a field trip day. Replace the regular schedule with one 3-hour outing block (Adventure type) from 10 AM–1 PM, plus a 20-min reflection journal block at 1:30 PM." },
                { label: "Catch-up day", prompt: "Make today a catch-up day. Pull any unfinished blocks from the last 5 school days and schedule them as 20-min blocks starting at 9 AM. Add a 15-min review block at the end." },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setInstruction(t.prompt)}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20"
                >
                  {t.label}
                </button>
              ))}
              {/* Push 19 — direct, instant, lossless copy buttons (bypass LLM). */}
              <button
                type="button"
                disabled={!copyFromDateM || copyFromDateM.isPending}
                onClick={() => copyFromDateM?.mutate?.({ sourceDate: dateMinusDays(date, 1), targetDate: date })}
                className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                data-testid="copy-yesterday-btn"
                title="Copy every block from yesterday onto this date (lossless, instant)"
              >
                {copyFromDateM?.isPending ? "Copying…" : "→ Copy yesterday"}
              </button>
              <button
                type="button"
                disabled={!copyFromDateM || copyFromDateM.isPending}
                onClick={() => copyFromDateM?.mutate?.({ sourceDate: lastMondayBefore(date), targetDate: date })}
                className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                data-testid="copy-last-monday-btn"
                title="Copy every block from the previous Monday onto this date (lossless, instant)"
              >
                {copyFromDateM?.isPending ? "Copying…" : "→ Copy last Monday"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {[
              "Make it shorter and fun",
              "More math today",
              "Add a 20-min read aloud after lunch",
              "Start at 9 AM, 25-min blocks",
              "Move math to the morning",
              "Drop the catch-up block",
              "Tutor not here — push everything to tomorrow",
              "Swap science topic to weather",
              "Add a brain break before lunch",
              "Make every block 20 min",
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setInstruction(sample)}
                className="rounded-full border border-border px-3 py-1 hover:bg-accent"
              >
                {sample}
              </button>
            ))}
          </div>
          {attachment && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-accent/30 px-3 py-2 text-sm">
              <span aria-hidden>{attachment.mimeType.startsWith("image/") ? "🖼️" : "📄"}</span>
              <span className="truncate flex-1">{attachment.fileName}</span>
              <span className="opacity-60 text-xs">{attachment.mimeType}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-xs underline opacity-70 hover:opacity-100"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-sm rounded-full border border-border px-3 py-1 hover:bg-accent">
                {uploadM.isPending ? "Uploading…" : "📎 Attach worksheet / page"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="text-xs opacity-60">Tip: ⌘/Ctrl + Enter to send.</div>
            </div>
            <div className="flex gap-2">
              {savedSnapshot && (
                <Button variant="outline" onClick={onUndo} disabled={undoM.isPending}>
                  ↶ Undo last apply
                </Button>
              )}
              <Button size="lg" onClick={onSend} disabled={previewM.isPending || (!instruction.trim() && !attachment)}>
                {previewM.isPending ? "Thinking…" : "Send →"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* v2.16 (2026-05-17) — Free-form prompt panel with per-decision
          Accept/Reject. Sits between the wholesale-diff AI box and the
          old-style preview card. Defense-in-depth: this whole page is
          already gated to adults, and `plans.aiPropose` /
          `plans.aiApplyProposal` are familyAdminProcedure on the server. */}
      <FreeFormPromptPanel date={date} />

      {/* DIFF PREVIEW */}
      {editPlan && beforeBlocks && afterBlocks && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Preview
              <span className="text-xs font-normal rounded-full bg-amber-500/20 px-2 py-0.5">{editPlan.intent}</span>
            </CardTitle>
            <p className="text-sm opacity-80">{editPlan.summary}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {editPlan.warnings?.length > 0 && (
              <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs space-y-1">
                {editPlan.warnings.map((w: string, i: number) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="mb-2 text-sm font-medium">Before</div>
                <div className="space-y-2">
                  {beforeBlocks.length === 0 ? (
                    <div className="text-sm opacity-60 italic">no blocks</div>
                  ) : beforeBlocks.map(b => (
                    <BlockLine key={b.id} b={b} kind={diffBlock(b, afterById)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">After</div>
                <div className="space-y-2">
                  {afterBlocks.length === 0 ? (
                    <div className="text-sm opacity-60 italic">no blocks</div>
                  ) : afterBlocks.map(b => (
                    <BlockLine key={b.id} b={b} kind={b.id < 0 ? "new" : diffBlock(b, beforeById)} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEditPlan(null); setBeforeBlocks(null); setAfterBlocks(null); }}>
                Discard
              </Button>
              <Button onClick={onApply} disabled={commitM.isPending || editPlan.ops.length === 0}>
                {commitM.isPending ? "Applying…" : `Apply ${editPlan.ops.length} change${editPlan.ops.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TODAY'S BLOCKS — read-only quick view so the adult sees what they're editing */}
      {!editPlan && liveBlocks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span aria-hidden>🗓️</span>
              Current schedule for {date}
              <span className="text-xs font-normal opacity-60">({liveBlocks.length} blocks)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {liveBlocks.map(b => (
                <BlockLine key={b.id} b={b} kind="same" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Push 38 (2026-05-13) — Quick-attach worksheets sidebar.
          Surfaces every unpinned library item dated for the selected day so
          Mom can one-tap pin it to a block. Hidden when there are no live
          blocks (nothing to pin to). */}
      {!editPlan && liveBlocks.length > 0 && (
        <QuickAttachWorksheets date={date} liveBlocks={liveBlocks} />
      )}

      {/* MANUAL BLOCK EDITOR — demoted to collapsible "Advanced" footer */}
      <details className="rounded-lg border border-border/60 bg-card/30">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium opacity-80 hover:opacity-100">
          ⚙️ Advanced — manual block editor
          <span className="ml-2 text-xs opacity-60">(prefer the AI box above for everyday changes)</span>
        </summary>
        <div className="border-t border-border/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">Shift whole day:</span>
              <Button size="sm" variant="outline" onClick={() => shiftDayM.mutate({ date, minutes: -15 })} disabled={shiftDayM.isPending}>− 15 min</Button>
              <Button size="sm" variant="outline" onClick={() => shiftDayM.mutate({ date, minutes: -5 })} disabled={shiftDayM.isPending}>− 5</Button>
              <Button size="sm" variant="outline" onClick={() => shiftDayM.mutate({ date, minutes: 5 })} disabled={shiftDayM.isPending}>+ 5</Button>
              <Button size="sm" variant="outline" onClick={() => shiftDayM.mutate({ date, minutes: 15 })} disabled={shiftDayM.isPending}>+ 15 min</Button>
            </div>
            <Button
              size="sm"
              onClick={() => blockCreateM.mutate({ date, title: "New block", blockType: "custom" as any, durationMin: 30 })}
              disabled={blockCreateM.isPending}
            >
              {blockCreateM.isPending ? "Adding…" : "+ Add block"}
            </Button>
          </div>
          {snapQ.isLoading ? (
            <div className="opacity-60 text-sm">Loading…</div>
          ) : liveBlocks.length === 0 ? (
            <div className="opacity-60 text-sm italic">No blocks yet for {date}.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] opacity-60 px-1">Drag the ☰ handle to reorder. Times use 12-hr (“9:00 AM”, “1:30 PM”).</div>
              <div className="grid gap-2 text-xs opacity-60 px-1" style={{ gridTemplateColumns: "24px 90px 56px 1fr 130px 130px 130px 130px" }}>
                <div></div>
                <div>Time</div>
                <div>Min</div>
                <div>Title</div>
                <div>Type</div>
                <div>Subject</div>
                <div>Topic</div>
                <div className="text-right">·</div>
              </div>
              {liveBlocks.map((b) => (
                <ManualBlockRow
                  key={b.id}
                  date={date}
                  block={b}
                  subjects={subjects}
                  topicCatalog={topicCatalog}
                  isDragging={draggingId === b.id}
                  isDragOver={dragOverId === b.id && draggingId !== b.id}
                  onDragStart={() => setDraggingId(b.id)}
                  onDragEnter={() => setDragOverId(b.id)}
                  onDragEnd={() => {
                    if (draggingId != null && dragOverId != null && draggingId !== dragOverId) {
                      const ids = liveBlocks.map(x => x.id);
                      const from = ids.indexOf(draggingId);
                      const to = ids.indexOf(dragOverId);
                      if (from >= 0 && to >= 0) {
                        const next = ids.slice();
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        blockReorderM.mutate({ date, orderedIds: next });
                      }
                    }
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onPatch={(patch) => blockUpdateM.mutate({ id: b.id, ...patch })}
                  onDelete={() => blockDeleteM.mutate({ id: b.id })}
                  onMoveToTomorrow={postponeBlockM ? () => {
                    const t = new Date(date + "T00:00:00");
                    const tom = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
                    const yyyy = tom.getFullYear();
                    const mm = String(tom.getMonth() + 1).padStart(2, "0");
                    const dd = String(tom.getDate()).padStart(2, "0");
                    postponeBlockM.mutate({ blockId: b.id, toDate: `${yyyy}-${mm}-${dd}` });
                  } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function QuickAttachWorksheets({ date, liveBlocks }: { date: string; liveBlocks: Snapshot[] }) {
  // Pull every library item dated for the selected day. The library router
  // already supports filter by `dateFor` + `blockId` so we can split
  // unpinned vs pinned in one round-trip per state slice. Soft-fail (any)
  // so a stale client never crashes the page.
  const unpinnedQ = (trpc as any).library?.list?.useQuery?.({
    dateFor: date, blockId: null, limit: 50, orderBy: "recommendedUse",
  }) ?? { data: null, isLoading: false };
  const pinnedQ = (trpc as any).library?.list?.useQuery?.({
    dateFor: date, limit: 100, orderBy: "recommendedUse",
  }) ?? { data: null };
  const updateM = (trpc as any).library?.update?.useMutation?.({
    onSuccess: () => {
      // Hand the cache a fresh page — cheap because the strip is small.
      (trpc as any).useUtils?.()?.library?.list?.invalidate?.();
    },
  });
  const items: any[] = (unpinnedQ.data as any[]) ?? [];
  const pinned: any[] = (pinnedQ.data as any[]) ?? [];
  // Filter pinned client-side to ones actually attached to a live block on
  // this date (some library rows are dateFor="YYYY-MM-DD" but blockId is
  // null on a different day).
  const liveIds = new Set(liveBlocks.map((b) => b.id));
  const pinnedForToday = pinned.filter((p) => p.blockId && liveIds.has(p.blockId));
  const unpinnedForToday = items.filter((p) => !p.blockId);
  if (unpinnedForToday.length === 0 && pinnedForToday.length === 0) {
    // "Don't show if no info" — nothing to attach, nothing pinned yet.
    return null;
  }
  const blockLabel = (b: Snapshot) => {
    const t = b.startTime ? formatTime12h(b.startTime) : "";
    return `${t ? t + " · " : ""}${b.title}`;
  };
  return (
    <Card data-testid="quick-attach-worksheets">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span aria-hidden>📎</span>
          Quick-attach worksheets for {date}
          <span className="text-xs font-normal opacity-60">
            ({unpinnedForToday.length} unpinned, {pinnedForToday.length} pinned)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {unpinnedForToday.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs opacity-70">Today's library items that aren't pinned to a block yet:</div>
            {unpinnedForToday.map((it: any) => (
              <div key={it.id} className="flex items-center gap-2 flex-wrap rounded border border-border/60 bg-card/40 px-2 py-1.5">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted opacity-70">{it.type}</span>
                {it.subjectSlug && (
                  <span className="text-[11px] opacity-70">{it.subjectSlug}</span>
                )}
                <span className="text-sm flex-1 min-w-0 truncate" title={it.title}>{it.title}</span>
                <Select
                  onValueChange={(v) => {
                    if (!v || !updateM) return;
                    const blockId = Number(v);
                    updateM.mutate({ id: it.id, patch: { blockId } });
                    toast.success(`Attached “${it.title}” to block.`);
                  }}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue placeholder="Attach to block…" />
                  </SelectTrigger>
                  <SelectContent>
                    {liveBlocks.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{blockLabel(b)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
        {pinnedForToday.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs opacity-70">Already pinned to blocks today:</div>
            {pinnedForToday.map((it: any) => {
              const block = liveBlocks.find((b) => b.id === it.blockId);
              return (
                <div key={it.id} className="flex items-center gap-2 flex-wrap rounded border border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/20 px-2 py-1.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-800/40">{it.type}</span>
                  <span className="text-sm flex-1 min-w-0 truncate" title={it.title}>{it.title}</span>
                  {block && (
                    <span className="text-[11px] opacity-70 truncate max-w-[12rem]">→ {blockLabel(block)}</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (!updateM) return;
                      updateM.mutate({ id: it.id, patch: { blockId: null } });
                      toast.success(`Unpinned “${it.title}”.`);
                    }}
                  >
                    Unpin
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManualBlockRow({
  date, block, subjects, topicCatalog, onPatch, onDelete, onMoveToTomorrow,
  isDragging, isDragOver, onDragStart, onDragEnter, onDragEnd,
}: {
  /** v2.19 — forwarded so the printables sub-panel can scope per-day. */
  date: string;
  block: Snapshot;
  subjects: Array<{ slug: string; name: string }>;
  topicCatalog: Array<{ code: string; title: string; subjectSlug: string }>;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onPatch: (patch: any) => void;
  onDelete: () => void;
  onMoveToTomorrow?: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [startTime, setStartTime] = useState(formatTime12h(block.startTime));
  const [durationMin, setDurationMin] = useState<number>(block.durationMin);
  // Push 42 (2026-05-13) — per-field edit completeness.
  // Description (notes) is now inline so Mom + Grandma can edit it without
  // opening the modal. Patches on blur.
  const [description, setDescription] = useState<string>(block.description ?? "");

  useEffect(() => { setTitle(block.title); }, [block.title]);
  useEffect(() => { setStartTime(formatTime12h(block.startTime)); }, [block.startTime]);
  useEffect(() => { setDurationMin(block.durationMin); }, [block.durationMin]);
  useEffect(() => { setDescription(block.description ?? ""); }, [block.description]);

  // Filter topics by chosen subject
  const eligibleTopics = topicCatalog.filter(
    (t) => !block.subjectSlug || t.subjectSlug === block.subjectSlug
  ).slice(0, 200);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Required for Firefox to actually start a drag
        try { e.dataTransfer.setData("text/plain", String(block.id)); } catch { /* noop */ }
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDragEnd(); }}
      onDragEnd={onDragEnd}
      className={
        "grid gap-2 items-center rounded border px-1 py-1 transition " +
        (isDragging ? "opacity-50 border-primary" : isDragOver ? "border-primary bg-primary/5" : "border-border/60")
      }
      style={{ gridTemplateColumns: "24px 90px 56px 1fr 130px 130px 130px 130px" }}
    >
      <span
        className="cursor-grab select-none text-base opacity-50 hover:opacity-100"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >☰</span>
      <Input
        className="h-8 text-xs"
        value={startTime}
        placeholder="9:00 AM"
        onChange={(e) => setStartTime(e.target.value)}
        onBlur={() => {
          const trimmed = startTime.trim();
          if (!trimmed) {
            if (block.startTime != null) onPatch({ startTime: null });
            return;
          }
          const canon = parseTime12h(trimmed);
          if (!canon) { toast.error("Try “9:00 AM” or “1:30 PM”"); setStartTime(formatTime12h(block.startTime)); return; }
          if (canon !== (block.startTime || null)) onPatch({ startTime: canon });
          setStartTime(formatTime12h(canon));
        }}
      />
      <Input
        type="number"
        className="h-8 text-xs"
        value={durationMin}
        min={5}
        max={180}
        onChange={(e) => setDurationMin(Number(e.target.value))}
        onBlur={() => {
          if (durationMin !== block.durationMin && durationMin >= 5 && durationMin <= 180) {
            onPatch({ durationMin });
          }
        }}
      />
      <Input
        className="h-8 text-xs"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== block.title) onPatch({ title }); }}
      />
      <Select value={block.blockType} onValueChange={(v) => onPatch({ blockType: v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={block.subjectSlug ?? "__none"} onValueChange={(v) => onPatch({ subjectSlug: v === "__none" ? null : v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— none —</SelectItem>
          {subjects.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={block.curriculumTopicCode ?? "__none"} onValueChange={(v) => onPatch({ curriculumTopicCode: v === "__none" ? null : v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— none —</SelectItem>
          {eligibleTopics.map((t) => (
            <SelectItem key={t.code} value={t.code}>{t.code} · {t.title.slice(0, 40)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-end gap-1">
        {onMoveToTomorrow && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs whitespace-nowrap"
            title="Re-parent this block to tomorrow's plan"
            onClick={onMoveToTomorrow}
          >
            → Tom.
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-red-500 hover:text-red-700"
          onClick={() => {
            if (confirm(`Delete "${block.title}"?`)) onDelete();
          }}
        >
          Del
        </Button>
      </div>
      {/* Push 42 (2026-05-13) — inline description editor. Spans the right
          half of the row so adults can drop quick notes on a block without
          opening the modal. Patches on blur. */}
      <div style={{ gridColumn: "4 / -1" }}>
        <Input
          className="h-7 text-[11px] mt-1 bg-transparent"
          placeholder="Notes for this block (videos, hints, pacing)…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            const next = description.trim() === "" ? null : description;
            if (next !== (block.description ?? null)) {
              onPatch({ description: next });
            }
          }}
          data-testid={`block-description-input-${block.id}`}
        />
      </div>
      {/* v2.15 (2026-05-17) — BlockResourcesPanel: lets Mom + Grandma
          attach materials/links/printables to the curriculum topic this
          block points at. Hidden when no topic is set. Spans full row. */}
      <div style={{ gridColumn: "1 / -1" }}>
        <BlockResourcesPanel topicCode={block.curriculumTopicCode ?? null} />
      </div>
      {/* v2.18 (2026-05-17) — BlockAdventurePanel: when this block is
          tied to an adventure, surface its materials list inline so Mom
          can edit (familyAdmin-gated server-side). Hidden when no
          adventureId. Spans full row. */}
      <div style={{ gridColumn: "1 / -1" }}>
        <BlockAdventurePanel adventureId={(block as any).adventureId ?? null} />
      </div>
      {/* v2.19 (2026-05-17) — BlockPrintablesPanel: per-block worksheet
          attachments (have-to-do / optional / extra). Mom adds the URL
          + title; Reagan sees the row in her day and earns coins on
          completion. Always visible because every block has a date +
          id, even ones not tied to a topic or adventure. Spans full row. */}
      <div style={{ gridColumn: "1 / -1" }}>
        <BlockPrintablesPanel date={date} blockId={String(block.id)} />
      </div>
    </div>
  );
}
