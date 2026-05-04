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
  const blockCreateM = trpc.blocks.createForDate.useMutation({
    onSuccess: () => {
      toast.success("Block added — edit it inline below.");
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Add block failed: " + e.message),
  });
  const blockReorderM = trpc.blocks.reorder.useMutation({
    onSuccess: () => utils.agendaEditor.snapshot.invalidate({ date }),
    onError: (e) => toast.error("Reorder failed: " + e.message),
  });
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

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Agenda Editor</h1>
          <p className="text-sm opacity-70">Just tell the AI what you want — rearrange, swap topics, change tutors, push the day, anything. It edits the agenda for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
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
              <div className="grid gap-2 text-xs opacity-60 px-1" style={{ gridTemplateColumns: "24px 90px 56px 1fr 130px 130px 130px 70px" }}>
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
                />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function ManualBlockRow({
  block, subjects, topicCatalog, onPatch, onDelete,
  isDragging, isDragOver, onDragStart, onDragEnter, onDragEnd,
}: {
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
}) {
  const [title, setTitle] = useState(block.title);
  const [startTime, setStartTime] = useState(formatTime12h(block.startTime));
  const [durationMin, setDurationMin] = useState<number>(block.durationMin);

  useEffect(() => { setTitle(block.title); }, [block.title]);
  useEffect(() => { setStartTime(formatTime12h(block.startTime)); }, [block.startTime]);
  useEffect(() => { setDurationMin(block.durationMin); }, [block.durationMin]);

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
      style={{ gridTemplateColumns: "24px 90px 56px 1fr 130px 130px 130px 70px" }}
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-red-500 hover:text-red-700 justify-end"
        onClick={() => {
          if (confirm(`Delete "${block.title}"?`)) onDelete();
        }}
      >
        Delete
      </Button>
    </div>
  );
}
