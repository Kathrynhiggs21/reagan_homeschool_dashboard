/**
 * AgendaEditor — unified AI chat schedule editor for adults.
 *
 * One AI chat box does everything: add, remove, reorder, reschedule, change
 * subjects, add notes, push the whole day — all from plain English.
 * Changes are applied immediately (no preview/confirm step).
 * The manual block grid is still available as an advanced fallback.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { parseTime12h, formatTime12h } from "@/lib/time12h";
import { useTutorMode } from "@/hooks/useTutorMode";
import { BlockResourcesPanel } from "@/components/BlockResourcesPanel";
import { BlockAdventurePanel } from "@/components/BlockAdventurePanel";
import { BlockPrintablesPanel } from "@/components/BlockPrintablesPanel";
import { Loader2, Send, Sparkles, Paperclip } from "lucide-react";
import { Streamdown } from "streamdown";

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

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "Make it shorter and fun today",
  "Add a 20-min read aloud after lunch",
  "Start at 9 AM with 25-min blocks",
  "Move math to the morning",
  "Tutor not here — push everything to tomorrow",
  "Add a brain break before lunch",
  "Make every block 20 min",
  "Swap science to weather topic",
  "Drop the catch-up block",
  "Add a vet appointment at noon for 45 min",
];

export default function AgendaEditor() {
  const [date, setDate] = useState<string>(todayYmd());

  // ─── Unified chat state ────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [attachment, setAttachment] = useState<{ url: string; mimeType: string; fileName: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  const chatM = (trpc as any).agendaEditor?.chat?.useMutation?.({
    onSuccess: (data: any) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      setAttachment(null);
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e: any) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Sorry, something went wrong: ${e?.message || "unknown error"}` }]);
    },
  });

  const uploadM = trpc.agendaEditor.uploadAttachment.useMutation({
    onError: (e) => toast.error("Upload failed: " + e.message),
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  const sendChat = () => {
    const trimmed = chatInput.trim();
    if (!trimmed && !attachment) return;
    if (!chatM) { toast.error("Chat not available."); return; }
    const userMsg = trimmed || "(attached file)";
    setChatMessages(prev => [...prev, { role: "user", content: userMsg + (attachment ? `\n\n📎 ${attachment.fileName}` : "") }]);
    setChatInput("");
    chatM.mutate({
      date,
      message: trimmed || "Read the attached file and work it into today's plan.",
      attachmentUrl: attachment?.url,
      attachmentMimeType: attachment?.mimeType,
    });
  };

  // ─── Manual grid state (kept as advanced fallback) ─────────────────────────────
  const clearDayMut = (trpc as any).blocks.clearDay.useMutation({
    onSuccess: async (r: any) => {
      toast.success(`Cleared ${r?.deleted ?? 0} block(s). Tell the AI what to build.`);
      await utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not clear day"),
  });
  const snapQ = trpc.agendaEditor.snapshot.useQuery({ date });
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
  const postponeBlockM = (trpc as any).adultAi?.postponeBlock?.useMutation?.({
    onSuccess: () => { utils.agendaEditor.snapshot.invalidate({ date }); utils.plans.byDate.invalidate(); utils.plans.today.invalidate(); toast.success("Moved to tomorrow."); },
    onError: (e: any) => toast.error(e?.message || "Move failed."),
  });
  const blockReorderM = trpc.blocks.reorder.useMutation({
    onSuccess: () => utils.agendaEditor.snapshot.invalidate({ date }),
    onError: (e) => toast.error("Reorder failed: " + e.message),
  });
  const copyFromDateM = (trpc as any).blocks?.copyFromDate?.useMutation?.({
    onSuccess: (r: any) => {
      if (r?.copied > 0) toast.success(`Copied ${r.copied} block${r.copied === 1 ? "" : "s"} into ${date}.`);
      else if (r?.reason === "no-source-plan" || r?.reason === "empty-source") toast.info("That source day was empty.");
      else if (r?.reason === "same-date") toast.info("Source and target date are the same.");
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e: any) => toast.error("Copy failed: " + (e?.message || "unknown")),
  });
  const dateMinusDays = (iso: string, days: number): string => {
    const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10);
  };
  const lastMondayBefore = (iso: string): string => {
    const d = new Date(iso + "T00:00:00"); const dow = d.getDay();
    const back = dow === 1 ? 7 : (dow + 6) % 7; d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10);
  };
  const shiftDayM = trpc.blocks.shiftDay.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Shifted ${data.shifted} block${data.shifted === 1 ? "" : "s"}` + (data.skipped ? ` (skipped ${data.skipped})` : ""));
      utils.agendaEditor.snapshot.invalidate({ date });
    },
    onError: (e) => toast.error("Shift failed: " + e.message),
  });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

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

      {/* ─── UNIFIED AI CHAT ─────────────────────────────────────────────────── */}
      <Card className="border-primary/40 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Agenda Editor
          </CardTitle>
          <p className="text-sm opacity-70">Tell me anything — add blocks, remove them, change times, reschedule the whole day, add notes, swap subjects. Changes apply immediately.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Copy shortcuts */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              disabled={!copyFromDateM || copyFromDateM.isPending}
              onClick={() => copyFromDateM?.mutate?.({ sourceDate: dateMinusDays(date, 1), targetDate: date })}
              className="rounded-full border border-emerald-400 bg-emerald-500/20 px-3 py-1.5 font-medium text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
              data-testid="copy-yesterday-btn"
            >
              {copyFromDateM?.isPending ? "Copying…" : "→ Copy yesterday"}
            </button>
            <button
              type="button"
              disabled={!copyFromDateM || copyFromDateM.isPending}
              onClick={() => copyFromDateM?.mutate?.({ sourceDate: lastMondayBefore(date), targetDate: date })}
              className="rounded-full border border-emerald-400 bg-emerald-500/20 px-3 py-1.5 font-medium text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
              data-testid="copy-last-monday-btn"
            >
              {copyFromDateM?.isPending ? "Copying…" : "→ Copy last Monday"}
            </button>
          </div>

          {/* Chat history */}
          {chatMessages.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3 max-h-80 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-card border border-border/60"
                  }`}>
                    {msg.role === "assistant" ? (
                      <Streamdown>{msg.content}</Streamdown>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {chatM?.isPending && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  </div>
                  <div className="rounded-xl px-3 py-2 text-sm bg-card border border-border/60 opacity-70">Thinking…</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Suggestion chips — only show when chat is empty */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChatInput(p)}
                  className="rounded-full border border-border px-3 py-1.5 hover:bg-accent transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Attachment preview */}
          {attachment && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-accent/30 px-3 py-2 text-sm">
              <span aria-hidden>{attachment.mimeType.startsWith("image/") ? "🖼️" : "📄"}</span>
              <span className="truncate flex-1">{attachment.fileName}</span>
              <button type="button" onClick={() => setAttachment(null)} className="text-xs underline opacity-70 hover:opacity-100">Remove</button>
            </div>
          )}

          {/* Composer */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Type anything… 'add Ali therapy at noon', 'move math earlier', 'make today shorter', 'Sophie starts at 1pm for fun activities'…"
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 pr-10"
              />
            </div>
            <label className="cursor-pointer flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-accent transition-colors shrink-0" title="Attach file">
              {uploadM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }} />
            </label>
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              onClick={sendChat}
              disabled={chatM?.isPending || (!chatInput.trim() && !attachment)}
            >
              {chatM?.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="text-xs opacity-50">Enter to send · Shift+Enter for new line · Changes apply immediately</div>
        </CardContent>
      </Card>

      {/* TODAY'S BLOCKS — live schedule view */}
      {liveBlocks.length > 0 && (
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

      {/* Quick-attach worksheets */}
      {liveBlocks.length > 0 && (
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
