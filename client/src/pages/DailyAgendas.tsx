import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TutorDayNotesBox from "@/components/TutorDayNotesBox";

/**
 * Daily Schedule (adult page).
 *
 * Layout (top → bottom):
 *   1) Day picker + tutor of the day banner
 *   2) Tutor Day Notes box  ← anyone can drop a note about how today went
 *   3) Today's plan summary  ← read-only-ish view of today's blocks
 *   4) Indian Hill agenda mirror  ← collapsed by default, supporting context
 *
 * Live editing of blocks happens via the universal AI search bar on
 * /library (Agenda Editor). This page is for "what's on today" + notes.
 */
export default function DailyAgendas() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState(today);

  const planQ = trpc.plans.byDate.useQuery({ date: dateStr });
  const tutorQ = (trpc as any).tutors?.tutorOfDay?.useQuery?.({ dateStr }) ?? {
    data: null,
    isLoading: false,
  };

  const plan = (planQ.data as any) ?? null;
  const blocks: any[] = plan?.blocks ?? [];

  const tutorOfDayName: string | undefined =
    (tutorQ.data as any)?.name ?? undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Daily Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Today&rsquo;s plan, notes from whoever&rsquo;s here with Reagan, and the school
          agenda for context. Pick a different day to look back or ahead.
        </p>
      </header>

      {/* Day picker + tutor of the day */}
      <Card className="cozy-card p-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Day</div>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value || today)}
            className="w-44"
          />
        </div>
        <div className="ml-auto text-sm">
          {tutorOfDayName ? (
            <span>
              <span className="text-muted-foreground">With Reagan today: </span>
              <span className="font-medium">{tutorOfDayName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">No tutor scheduled.</span>
          )}
        </div>
      </Card>

      {/* Tutor Day Notes — top of page */}
      <TutorDayNotesBox dateStr={dateStr} tutorOfDayName={tutorOfDayName} />

      {/* Today's plan summary */}
      <Card className="cozy-card p-4">
        <div className="font-display font-semibold mb-2">Plan for {dateStr}</div>
        {planQ.isLoading ? (
          <div className="text-sm text-muted-foreground italic">Loading…</div>
        ) : !plan || blocks.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            No plan yet for this day. Open the Agenda Editor to generate one.
          </div>
        ) : (
          <ul className="space-y-2">
            {blocks
              .slice()
              .sort(
                (a, b) =>
                  String(a.startTime ?? "").localeCompare(
                    String(b.startTime ?? ""),
                  ),
              )
              .map((b: any) => (
                <li
                  key={b.id}
                  className="border rounded-md p-2 flex items-start gap-3 bg-white/40"
                >
                  <div className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                    {b.startTime ?? "—"} – {b.endTime ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{b.title}</div>
                    {b.curriculumTopicCode && (
                      <div className="text-xs text-muted-foreground">
                        {b.curriculumTopicCode}
                        {b.subjectName ? ` · ${b.subjectName}` : ""}
                      </div>
                    )}
                    {b.description && (
                      <div className="text-xs mt-1 text-muted-foreground whitespace-pre-wrap">
                        {b.description}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {b.status ?? "not_started"}
                  </Badge>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {/* Indian Hill mirror — collapsed by default for supporting context */}
      <IHAgendaMirror dateStr={dateStr} />
    </div>
  );
}

function IHAgendaMirror({ dateStr }: { dateStr: string }) {
  const [open, setOpen] = useState(false);
  const list = trpc.classroom.list.useQuery({ limit: 60 });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    agendaDate: dateStr,
    teacher: "",
    course: "",
    rawText: "",
  });

  const insert = trpc.classroom.insert.useMutation({
    onSuccess: () => {
      utils.classroom.list.invalidate();
      toast.success("Agenda saved");
      setForm({ ...form, rawText: "", teacher: "", course: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = (list.data as any[]) || [];
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of rows) (g[r.agendaDate] ??= []).push(r);
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  return (
    <Card className="cozy-card p-4">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <div className="font-display font-semibold">Indian Hill agendas</div>
          <div className="text-xs text-muted-foreground">
            What Reagan&rsquo;s teachers posted (auto-synced + manual paste). Use as
            context, not the source of truth.
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Paste form */}
          <div className="rounded-md border p-3 bg-white/40">
            <div className="text-sm font-semibold mb-2">Paste an agenda</div>
            <div className="grid sm:grid-cols-3 gap-2 mb-2">
              <Input
                type="date"
                value={form.agendaDate}
                onChange={(e) => setForm({ ...form, agendaDate: e.target.value })}
              />
              <Input
                placeholder="Teacher (e.g. Mr. Froehlich)"
                value={form.teacher}
                onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              />
              <Input
                placeholder="Course (e.g. ELA Q4)"
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
              />
            </div>
            <Textarea
              rows={4}
              placeholder="Paste the raw agenda text, email, or image transcript here…"
              value={form.rawText}
              onChange={(e) => setForm({ ...form, rawText: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button
                onClick={() => {
                  if (!form.agendaDate || !form.rawText.trim()) {
                    toast.error("Date + agenda text required.");
                    return;
                  }
                  insert.mutate({
                    agendaDate: form.agendaDate,
                    teacher: form.teacher || undefined,
                    course: form.course || undefined,
                    rawText: form.rawText,
                    source: "manual",
                  });
                }}
                disabled={insert.isPending}
              >
                {insert.isPending ? "Saving…" : "Save agenda"}
              </Button>
            </div>
          </div>

          {/* List */}
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No agendas yet. Paste one above, or wait for the next sync.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.slice(0, 6).map(([date, items]) => (
                <div key={date} className="border rounded-md p-3 bg-white/40">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-display font-semibold">
                      {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h2>
                    <div className="text-[10px] text-muted-foreground">
                      {items.length} agenda{items.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map((a: any) => (
                      <div key={a.id} className="text-sm">
                        <div className="font-semibold">
                          {a.course ?? "—"}
                          {a.teacher ? ` · ${a.teacher}` : ""}
                        </div>
                        {Array.isArray(a.topics) && a.topics.length > 0 && (
                          <ul className="list-disc list-inside text-xs mt-0.5 text-muted-foreground">
                            {a.topics.slice(0, 4).map((t: string, i: number) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
