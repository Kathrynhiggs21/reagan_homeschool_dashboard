import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import TutorDayNotesBox from "@/components/TutorDayNotesBox";

/**
 * Daily Schedule (adult page).
 *
 * Layout (top → bottom):
 *   1) Day picker + tutor of the day banner
 *   2) Tutor Day Notes box  ← anyone can drop a note about how today went
 *   3) Today's plan summary  ← read-only-ish view of today's blocks
 *
 * Live editing of blocks happens via the universal AI search bar on
 * /library (Agenda Editor). This page is for "what's on today" + notes.
 *
 * 2026-05-04: removed the Indian Hill agenda mirror per user request — IH is
 * not the source of truth and the mirror was visually competing with the
 * actual plan summary on the same page.
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
                  className="rounded-md p-2.5 flex items-start gap-3 border border-white/15 bg-black/30 text-foreground"
                >
                  <div className="text-xs font-mono opacity-90 w-24 shrink-0">
                    {b.startTime ?? "—"} – {b.endTime ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{b.title}</div>
                    {b.curriculumTopicCode && (
                      <div className="text-xs opacity-80">
                        {b.curriculumTopicCode}
                        {b.subjectName ? ` · ${b.subjectName}` : ""}
                      </div>
                    )}
                    {b.description && (
                      <div className="text-xs mt-1 opacity-95 whitespace-pre-wrap">
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

    </div>
  );
}
