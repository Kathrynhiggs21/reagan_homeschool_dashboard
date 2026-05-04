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
        <span className="font-mono text-xs opacity-70">{b.startTime ?? "--:--"}</span>
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
  const snapQ = trpc.agendaEditor.snapshot.useQuery({ date });

  const previewM = trpc.agendaEditor.preview.useMutation({
    onSuccess: (data: any) => {
      setEditPlan(data.plan);
      setBeforeBlocks(data.before);
      setAfterBlocks(data.after);
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

  const onSend = () => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    previewM.mutate({ date, instruction: trimmed });
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

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Agenda Editor</h1>
          <p className="text-sm opacity-70">Tell the AI anything — vague vibes, targeted shifts, surgical swaps. Or edit each block manually below.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </header>

      {/* CHAT INSTRUCTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tell the AI what to change</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "make it shorter and fun", "more math today", "swap 10:30 to a nature walk", "start at 9, end by 1, 25-min blocks"'
            rows={3}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              "Make it shorter and fun",
              "More math today",
              "Add a 30-min adventure after lunch",
              "Start at 9 AM, 25-min blocks",
              "Move math to the morning",
              "Drop the catch-up block",
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
          <div className="flex justify-end gap-2">
            {savedSnapshot && (
              <Button variant="outline" onClick={onUndo} disabled={undoM.isPending}>
                ↶ Undo last apply
              </Button>
            )}
            <Button onClick={onSend} disabled={previewM.isPending || !instruction.trim()}>
              {previewM.isPending ? "Thinking…" : "Preview →"}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* MANUAL BLOCK GRID */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manual block editor</CardTitle>
          <p className="text-sm opacity-70">Edit any field on any block. Saves on blur.</p>
        </CardHeader>
        <CardContent>
          {snapQ.isLoading ? (
            <div className="opacity-60 text-sm">Loading…</div>
          ) : liveBlocks.length === 0 ? (
            <div className="opacity-60 text-sm italic">No blocks yet for {date}.</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs opacity-60 px-1">
                <div className="col-span-1">Time</div>
                <div className="col-span-1">Min</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Subject</div>
                <div className="col-span-2">Topic</div>
                <div className="col-span-1 text-right">·</div>
              </div>
              {liveBlocks.map((b) => (
                <ManualBlockRow
                  key={b.id}
                  block={b}
                  subjects={subjects}
                  topicCatalog={topicCatalog}
                  onPatch={(patch) => blockUpdateM.mutate({ id: b.id, ...patch })}
                  onDelete={() => blockDeleteM.mutate({ id: b.id })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManualBlockRow({
  block, subjects, topicCatalog, onPatch, onDelete,
}: {
  block: Snapshot;
  subjects: Array<{ slug: string; name: string }>;
  topicCatalog: Array<{ code: string; title: string; subjectSlug: string }>;
  onPatch: (patch: any) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [startTime, setStartTime] = useState(block.startTime ?? "");
  const [durationMin, setDurationMin] = useState<number>(block.durationMin);

  useEffect(() => { setTitle(block.title); }, [block.title]);
  useEffect(() => { setStartTime(block.startTime ?? ""); }, [block.startTime]);
  useEffect(() => { setDurationMin(block.durationMin); }, [block.durationMin]);

  // Filter topics by chosen subject
  const eligibleTopics = topicCatalog.filter(
    (t) => !block.subjectSlug || t.subjectSlug === block.subjectSlug
  ).slice(0, 200);

  return (
    <div className="grid grid-cols-12 gap-2 items-center rounded border border-border/60 px-1 py-1">
      <Input
        className="col-span-1 h-8 text-xs"
        value={startTime}
        placeholder="HH:MM"
        onChange={(e) => setStartTime(e.target.value)}
        onBlur={() => {
          const v = startTime.trim();
          if (v && !/^\d{1,2}:\d{2}$/.test(v)) { toast.error("Use HH:MM"); return; }
          if ((v || null) !== (block.startTime || null)) onPatch({ startTime: v || null });
        }}
      />
      <Input
        type="number"
        className="col-span-1 h-8 text-xs"
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
        className="col-span-3 h-8 text-xs"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== block.title) onPatch({ title }); }}
      />
      <Select value={block.blockType} onValueChange={(v) => onPatch({ blockType: v })}>
        <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={block.subjectSlug ?? "__none"} onValueChange={(v) => onPatch({ subjectSlug: v === "__none" ? null : v })}>
        <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— none —</SelectItem>
          {subjects.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={block.curriculumTopicCode ?? "__none"} onValueChange={(v) => onPatch({ curriculumTopicCode: v === "__none" ? null : v })}>
        <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— none —</SelectItem>
          {eligibleTopics.map((t) => (
            <SelectItem key={t.code} value={t.code}>{t.code} · {t.title.slice(0, 40)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="col-span-1 h-8 text-xs text-red-500 hover:text-red-700 justify-end"
        onClick={() => {
          if (confirm(`Delete "${block.title}"?`)) onDelete();
        }}
      >
        Delete
      </Button>
    </div>
  );
}
