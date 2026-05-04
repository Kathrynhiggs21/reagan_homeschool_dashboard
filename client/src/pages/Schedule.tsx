import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Sun, ExternalLink } from "lucide-react";
import TopicLabel from "@/components/TopicLabel";
import ActivityOptionsPanel from "@/components/ActivityOptionsPanel";

/**
 * Reagan-facing Schedule page.
 *
 * Replaces the old "This Week" page. Three views:
 *   - Day:   today's blocks + Indian Hill day-off label if present + a quick agenda
 *   - Week:  Mon-Fri grid with day-off marker + dot density per day
 *   - Month: 5-week mini-calendar with day-off shading
 *
 * IH days off come from the existing `schoolCalendar` tRPC router. Google Calendar
 * overlay is rendered as a placeholder strip until OAuth is granted (kept stub here
 * so wiring the real feed in the next checkpoint is just swapping the data source).
 *
 * Tap any day to open an Agenda dialog with that day's blocks (read-only for Reagan).
 */

// --- date helpers -----------------------------------------------------------

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}
function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function startOfMonth(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  out.setHours(0, 0, 0, 0);
  return out;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type View = "day" | "week" | "month";

// Friendly summer-break end date — Indian Hill summer typically starts late May.
// This matches the countdown shown in the sidebar.
const SUMMER_START = new Date(2026, 4, 22); // May 22 2026

// --- main page --------------------------------------------------------------

export default function Schedule() {
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState<Date>(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t;
  });
  const [agendaOpen, setAgendaOpen] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const calendarQ = trpc.schoolCalendar.list.useQuery();

  // Build a Date → off-info lookup once.
  const offByDate = useMemo(() => {
    const m: Record<string, { label: string; source?: string | null }> = {};
    for (const row of (calendarQ.data || []) as any[]) {
      if (row.isOff) m[row.date] = { label: row.label, source: row.source };
    }
    return m;
  }, [calendarQ.data]);

  // Days until summer break for the friendly banner.
  const daysToSummer = useMemo(() => {
    const ms = SUMMER_START.getTime() - today.getTime();
    return Math.max(0, Math.round(ms / 86400000));
  }, [today]);

  // ----- subviews ------------------------------------------------------------

  function dayLabel(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function shiftCursor(delta: number) {
    if (view === "day") setCursor(addDays(cursor, delta));
    else if (view === "week") setCursor(addDays(cursor, delta * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  return (
    <div className="container py-6 max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <div className="text-sm text-amber-700/80 font-display italic">Reagan&apos;s plan</div>
          <h1 className="text-3xl font-display font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-amber-700" /> Schedule
          </h1>
          <p className="text-sm text-muted-foreground max-w-prose">
            Tap any day to see what&apos;s on it. Off days from Indian Hill show up in pink.{" "}
            {daysToSummer > 0 && (
              <span className="font-semibold text-amber-800">{daysToSummer} day{daysToSummer === 1 ? "" : "s"} until summer break.</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
              className="capitalize"
            >
              {v}
            </Button>
          ))}
        </div>
      </header>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => shiftCursor(-1)}>
          <ChevronLeft className="w-4 h-4" /> Prev
        </Button>
        <div className="text-base font-display font-semibold text-amber-900 dark:text-amber-100">
          {view === "day" && dayLabel(cursor)}
          {view === "week" && `Week of ${dayLabel(startOfWeek(cursor))}`}
          {view === "month" && cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftCursor(1)}>
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {view === "day" && (
        <DayView
          date={cursor}
          today={today}
          offByDate={offByDate}
          onOpenAgenda={(d) => setAgendaOpen(ymd(d))}
        />
      )}
      {view === "week" && (
        <>
          <WeekView
            cursor={cursor}
            today={today}
            offByDate={offByDate}
            onOpenAgenda={(d) => setAgendaOpen(ymd(d))}
          />
          <ActivityOptionsPanel />
        </>
      )}
      {view === "month" && (
        <MonthView
          cursor={cursor}
          today={today}
          offByDate={offByDate}
          onOpenAgenda={(d) => setAgendaOpen(ymd(d))}
        />
      )}

      <GoogleCalendarOverlayStub />

      <div className="text-xs text-muted-foreground italic">
        Tip: tap a day to see its blocks. Tap <button className="underline" onClick={() => navigate("/today") }>Today</button> for a calmer single-day view with Kiwi.
      </div>

      <AgendaDialog open={!!agendaOpen} dateStr={agendaOpen} offInfo={agendaOpen ? offByDate[agendaOpen] : undefined} onClose={() => setAgendaOpen(null)} />
    </div>
  );
}

// --- Day view ---------------------------------------------------------------

function DayView({
  date, today, offByDate, onOpenAgenda,
}: { date: Date; today: Date; offByDate: Record<string, { label: string; source?: string | null }>; onOpenAgenda: (d: Date) => void; }) {
  const dateStr = ymd(date);
  const off = offByDate[dateStr];
  const planQ = trpc.plans.byDate.useQuery({ date: dateStr });
  const plan: any = planQ.data;
  const blocksQ = trpc.blocks.list.useQuery({ planId: plan?.id || 0 }, { enabled: !!plan?.id });
  const blocks: any[] = blocksQ.data || [];

  return (
    <Card className="p-5 bg-amber-50 dark:bg-amber-950/40 border-amber-200">
      {off && (
        <div className="rounded-xl bg-pink-100 border border-pink-300 text-pink-900 px-4 py-3 mb-4 flex items-center gap-2">
          <Sun className="w-4 h-4" />
          <div className="font-display font-semibold">{off.label}</div>
          <Badge variant="outline" className="ml-auto bg-pink-50">No school</Badge>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {isSameDay(date, today) ? "Today" : date.toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <Button size="sm" variant="outline" onClick={() => onOpenAgenda(date)}>
          Open agenda
        </Button>
      </div>
      {blocks.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          {off ? "Day off — no school blocks planned. Maybe a fun adventure today?" : "Nothing scheduled yet for this day."}
        </div>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b: any) => (
            <li key={b.id} className="flex flex-col gap-1 p-2 rounded-lg bg-white/70 dark:bg-amber-950/30 border border-amber-200">
              <div className="flex items-center gap-3">
                <Badge className="capitalize">{b.subjectSlug || b.kind || "block"}</Badge>
                <div className="font-medium">{b.title}</div>
                <div className="ml-auto text-xs text-muted-foreground">
                  {b.status === "complete" ? "✓ done" : "to do"}
                </div>
              </div>
              <TopicLabel subjectSlug={b.subjectSlug} topicName={b.curriculumTopicName ?? null} size="xs" />
            </li>
          ))}
        </ul>
      )}
      <DayIcalEvents dateStr={dateStr} />
    </Card>
  );
}

// --- iCal overlay block on the Day view ------------------------------------

function DayIcalEvents({ dateStr }: { dateStr: string }) {
  const eventsQ = trpc.icalFeeds.eventsBetween.useQuery({ startDate: dateStr, endDate: dateStr });
  const feedsQ = trpc.icalFeeds.list.useQuery();
  const colorByFeed = useMemo(() => {
    const m: Record<number, string> = {};
    for (const f of (feedsQ.data || []) as any[]) m[f.id] = f.color || "#0a66c2";
    return m;
  }, [feedsQ.data]);
  const events: any[] = eventsQ.data || [];
  if (events.length === 0) return null;
  const fmtTime = (d: any, allDay: boolean) => {
    if (allDay) return "All day";
    try {
      return new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  };
  return (
    <div className="mt-4 pt-3 border-t border-amber-200/60">
      <div className="text-xs font-display font-semibold text-amber-800 mb-2">Also on this day</div>
      <ul className="space-y-1.5">
        {events.map((e: any) => (
          <li key={e.id} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colorByFeed[e.feedId] || "#0a66c2" }}
            />
            <span className="font-medium text-amber-900 dark:text-amber-100">{e.summary}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {fmtTime(e.startsAt, !!e.allDay)}
              {e.location ? <span className="ml-2 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Week view --------------------------------------------------------------

function WeekView({
  cursor, today, offByDate, onOpenAgenda,
}: { cursor: Date; today: Date; offByDate: Record<string, { label: string; source?: string | null }>; onOpenAgenda: (d: Date) => void; }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d, i) => {
        const dateStr = ymd(d);
        const off = offByDate[dateStr];
        const isToday = isSameDay(d, today);
        return (
          <button
            key={dateStr}
            onClick={() => onOpenAgenda(d)}
            className={`text-left rounded-xl border p-3 transition hover:shadow-md
              ${isToday ? "ring-2 ring-amber-500" : ""}
              ${off ? "bg-pink-50 border-pink-300 text-pink-900" : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"}`}
          >
            <div className="text-[11px] uppercase tracking-wide opacity-70">{DOW[i]}</div>
            <div className="text-2xl font-display font-bold">{d.getDate()}</div>
            <div className="text-xs mt-1 line-clamp-2 min-h-[2.25rem]">
              {off ? off.label : isToday ? "Today" : "Tap to view"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// --- Month view -------------------------------------------------------------

function MonthView({
  cursor, today, offByDate, onOpenAgenda,
}: { cursor: Date; today: Date; offByDate: Record<string, { label: string; source?: string | null }>; onOpenAgenda: (d: Date) => void; }) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground">
        {DOW.map((d) => (<div key={d} className="px-2 py-1 text-center">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const dateStr = ymd(d);
          const off = offByDate[dateStr];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          return (
            <button
              key={dateStr}
              onClick={() => onOpenAgenda(d)}
              className={`aspect-square rounded-lg p-1.5 text-left text-xs flex flex-col transition hover:shadow
                ${!inMonth ? "opacity-40" : ""}
                ${isToday ? "ring-2 ring-amber-500" : ""}
                ${off ? "bg-pink-100 border border-pink-300 text-pink-900" : "bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"}`}
            >
              <div className="font-display font-semibold">{d.getDate()}</div>
              {off && <div className="text-[10px] line-clamp-2 leading-tight mt-auto">{off.label}</div>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-pink-200 border border-pink-300" /> Indian Hill day off</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded ring-2 ring-amber-500 bg-amber-50" /> Today</span>
      </div>
    </div>
  );
}

// --- Agenda dialog (tap a day) ---------------------------------------------

function AgendaDialog({ open, dateStr, offInfo, onClose }: {
  open: boolean; dateStr: string | null; offInfo?: { label: string; source?: string | null }; onClose: () => void;
}) {
  const planQ = trpc.plans.byDate.useQuery({ date: dateStr || "" }, { enabled: !!dateStr });
  const plan: any = planQ.data;
  const blocksQ = trpc.blocks.list.useQuery({ planId: plan?.id || 0 }, { enabled: !!plan?.id });
  const blocks: any[] = blocksQ.data || [];
  const dateLabel = dateStr ? new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-700" /> {dateLabel}
          </DialogTitle>
        </DialogHeader>
        {offInfo && (
          <div className="rounded-lg bg-pink-50 border border-pink-200 text-pink-900 px-3 py-2 text-sm">
            <div className="font-semibold">{offInfo.label}</div>
            {offInfo.source && <div className="text-xs opacity-70">{offInfo.source}</div>}
          </div>
        )}
        {blocks.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            {offInfo ? "No school blocks planned." : "Nothing scheduled for this day yet."}
          </div>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b: any) => (
              <li key={b.id} className="flex flex-col gap-1 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-3">
                  <Badge className="capitalize">{b.subjectSlug || b.kind || "block"}</Badge>
                  <div className="font-medium">{b.title}</div>
                  <div className="ml-auto text-xs text-muted-foreground">{b.status === "complete" ? "✓ done" : "to do"}</div>
                </div>
                <TopicLabel subjectSlug={b.subjectSlug} topicName={b.curriculumTopicName ?? null} size="xs" />
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- iCal subscriptions footer ---------------------------------------------

function GoogleCalendarOverlayStub() {
  const feedsQ = trpc.icalFeeds.list.useQuery();
  const feeds: any[] = feedsQ.data || [];
  if (feeds.length === 0) {
    return (
      <Card className="p-4 bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-4 h-4 mt-1" />
          <div className="flex-1 text-sm">
            <div className="font-display font-semibold">No calendars connected yet</div>
            <div>
              Add a public iCal feed (Indian Hill, soccer, family) so events show up here next to school. Adult only — Mom can paste an iCal URL from <a href="/calendars" className="underline font-semibold">Settings &rarr; Calendars</a>.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-4 bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
      <div className="flex items-start gap-3">
        <ExternalLink className="w-4 h-4 mt-1" />
        <div className="flex-1 text-sm">
          <div className="font-display font-semibold mb-1">Calendars overlaid here</div>
          <ul className="flex flex-wrap gap-2">
            {feeds.map((f) => (
              <li key={f.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/70 border border-blue-200 text-xs">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: f.color || "#0a66c2" }} />
                <span className="font-medium">{f.label}</span>
                {!f.enabled ? <span className="text-blue-700 italic">(off)</span> : null}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-blue-800/80">Manage in <a href="/calendars" className="underline">Settings &rarr; Calendars</a>.</div>
        </div>
      </div>
    </Card>
  );
}
