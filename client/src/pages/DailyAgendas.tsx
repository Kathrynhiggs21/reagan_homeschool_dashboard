import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Adult-only Daily Agendas viewer. Shows the classroomAgendas table
 * chronologically (newest first), grouped by date, with a paste-an-agenda
 * form for manual entries until the scheduled Classroom/Gmail job runs.
 */
export default function DailyAgendas() {
  const list = trpc.classroom.list.useQuery({ limit: 60 });
  const gaps = trpc.classroom.gaps.useQuery({ daysBack: 7 });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    agendaDate: new Date().toISOString().slice(0, 10),
    teacher: "",
    course: "",
    rawText: "",
  });

  const insert = trpc.classroom.insert.useMutation({
    onSuccess: () => {
      utils.classroom.list.invalidate();
      utils.classroom.gaps.invalidate();
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

  function onSubmit() {
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
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Daily Agendas 🗓️</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Indian Hill teacher agendas — auto-synced from Google Classroom &amp; teacher emails by the daily job.
          Paste one below manually any time.
        </p>
      </header>

      {/* Gaps hint */}
      {gaps.data && (gaps.data as any[]).length > 0 && (
        <Card className="cozy-card p-3 text-sm">
          <div className="font-semibold mb-1">Dates still missing agendas (last 7 days):</div>
          <div className="flex flex-wrap gap-1">
            {(gaps.data as any[]).map((g: any) => (
              <Badge key={g.date} variant="outline" className="text-xs">
                {g.date} ({g.have} on file)
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Paste form */}
      <Card className="cozy-card p-4">
        <div className="font-display font-semibold mb-2">Paste an agenda</div>
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
          rows={6}
          placeholder="Paste the raw agenda text, email, or image transcript here…"
          value={form.rawText}
          onChange={(e) => setForm({ ...form, rawText: e.target.value })}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={onSubmit} disabled={insert.isPending}>
            {insert.isPending ? "Saving…" : "Save agenda"}
          </Button>
        </div>
      </Card>

      {/* Agenda list grouped by date */}
      {rows.length === 0 ? (
        <Card className="cozy-card p-6 text-center text-sm text-muted-foreground italic">
          No agendas yet. Paste one above, or wait for the next scheduled sync.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <Card key={date} className="cozy-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-semibold text-lg">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
                <div className="text-[10px] text-muted-foreground">{items.length} agenda{items.length === 1 ? "" : "s"}</div>
              </div>
              <div className="space-y-3">
                {items.map((a: any) => (
                  <div key={a.id} className="p-3 rounded-md border bg-white/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{a.course ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.teacher ?? "—"} · {a.source}
                        </div>
                      </div>
                      {a.term && (
                        <Badge variant="outline" className="text-[10px]">
                          {a.term}
                        </Badge>
                      )}
                    </div>
                    {Array.isArray(a.topics) && a.topics.length > 0 && (
                      <ul className="list-disc list-inside text-sm mt-2 space-y-0.5">
                        {a.topics.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                    {Array.isArray(a.assignments) && a.assignments.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Assignments
                        </div>
                        <ul className="mt-1 space-y-1">
                          {a.assignments.map((ass: any, i: number) => (
                            <li key={i} className="text-sm">
                              <span className="font-semibold">{ass.title}</span>
                              {ass.dueAt && <span className="text-xs text-muted-foreground"> · due {ass.dueAt}</span>}
                              {ass.notes && <div className="text-xs text-muted-foreground">{ass.notes}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.rawText && (!Array.isArray(a.topics) || a.topics.length === 0) && (
                      <div className="text-sm mt-2 whitespace-pre-wrap bg-white/40 p-2 rounded border text-muted-foreground">
                        {a.rawText.slice(0, 600)}
                        {a.rawText.length > 600 ? "…" : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
