import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * /classes — Reagan's classroom integration page.
 *
 * Renders a row per canonical core-planning subject (Math, ELA, Science,
 * Social Studies). Each row has four lifecycle columns matching the Drive
 * folder structure:
 *
 *   To Do  ->  In Progress  ->  Turned In  ->  Graded
 *
 * Adults (Mom + Grandma) see the same picker chips Reagan sees, but
 * the gclassroom.assignments.updateStatus mutation is gated behind
 * familyAdminProcedure on the server. If Reagan taps a chip she gets a
 * gentle "ask Mom" toast instead of a wire-level error.
 *
 * Until Mom grants the OAuth scope on spear.cpt@gmail.com, the
 * classroomCourses + classroomAssignments tables are empty, so this
 * page renders an empty state per subject with a "Sync from Google
 * Classroom" button that returns the not_yet_authenticated stub.
 */

type Lifecycle = "to_do" | "in_progress" | "turned_in" | "graded";

const LIFECYCLE_COLUMNS: Array<{ key: Lifecycle; label: string; help: string }> = [
  { key: "to_do", label: "To Do", help: "Not started yet" },
  { key: "in_progress", label: "In Progress", help: "She's working on it" },
  { key: "turned_in", label: "Turned In", help: "Submitted, waiting" },
  { key: "graded", label: "Graded", help: "Done and back" },
];

const NEXT_STATUS: Record<Lifecycle, Lifecycle | null> = {
  to_do: "in_progress",
  in_progress: "turned_in",
  turned_in: "graded",
  graded: null,
};

const SUBJECT_EMOJI: Record<string, string> = {
  math: "🔢",
  ela: "📖",
  science: "🔬",
  social: "🗺️",
};

export default function Classes() {
  const subjectsQ = trpc.subjects.list.useQuery();
  const coursesQ = trpc.gclassroom.courses.list.useQuery();
  const assignmentsQ = trpc.gclassroom.assignments.byLifecycle.useQuery({ limit: 500 });

  const subjects = useMemo(() => {
    const all = subjectsQ.data ?? [];
    return (all as any[]).filter((s) => s.isCorePlanning);
  }, [subjectsQ.data]);

  const utils = trpc.useUtils();
  const updateStatus = trpc.gclassroom.assignments.updateStatus.useMutation({
    onSuccess: () => {
      utils.gclassroom.assignments.byLifecycle.invalidate();
    },
  });
  const sync = trpc.gclassroom.sync.useMutation();

  const assignmentsBySubject = useMemo(() => {
    const out = new Map<number | "unsorted", any[]>();
    for (const a of (assignmentsQ.data ?? []) as any[]) {
      const key = (a.subjectId ?? "unsorted") as number | "unsorted";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(a);
    }
    return out;
  }, [assignmentsQ.data]);

  const isLoading = subjectsQ.isLoading || coursesQ.isLoading || assignmentsQ.isLoading;
  const totalAssignments = (assignmentsQ.data ?? []).length;
  const totalCourses = (coursesQ.data ?? []).length;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Live view of work in Reagan's Google Classroom. Each row is a subject. Each column is where the work is in its life:
            from sitting in the queue, to in-progress, to turned in, to graded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{totalCourses} courses</Badge>
          <Badge variant="secondary">{totalAssignments} assignments</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await sync.mutateAsync();
              const title = r.status === "not_yet_authenticated" ? "Not connected yet" : "Synced";
              toast(title, { description: r.message });
            }}
            disabled={sync.isPending}
          >
            {sync.isPending ? "Syncing…" : "Sync from Google Classroom"}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading classes…</Card>
      ) : null}

      {!isLoading && totalAssignments === 0 ? (
        <Card className="p-6 bg-amber-50/40 dark:bg-amber-950/20">
          <h2 className="font-medium">No assignments synced yet.</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Once Mom authorizes Google Classroom on spear.cpt@gmail.com, courses and assignments will appear here grouped by subject.
            Each row of work moves left-to-right as Reagan progresses.
          </p>
        </Card>
      ) : null}

      <div className="space-y-5">
        {subjects.map((s: any) => {
          const items = assignmentsBySubject.get(s.id) ?? [];
          return (
            <SubjectRow
              key={s.id}
              subject={s}
              assignments={items}
              onUpdate={(args) => updateStatus.mutate(args)}
              busy={updateStatus.isPending}
            />
          );
        })}

        {assignmentsBySubject.has("unsorted") ? (
          <SubjectRow
            subject={{ id: -1, name: "Unsorted (no subject yet)", slug: "unsorted", emoji: "📥" }}
            assignments={assignmentsBySubject.get("unsorted") ?? []}
            onUpdate={(args) => updateStatus.mutate(args)}
            busy={updateStatus.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}

function SubjectRow({
  subject,
  assignments,
  onUpdate,
  busy,
}: {
  subject: { id: number; name: string; slug: string; emoji?: string };
  assignments: any[];
  onUpdate: (args: { assignmentId: number; toStatus: Lifecycle }) => void;
  busy: boolean;
}) {
  const emoji = subject.emoji ?? SUBJECT_EMOJI[subject.slug] ?? "📚";
  const grouped = useMemo(() => {
    const m: Record<Lifecycle, any[]> = { to_do: [], in_progress: [], turned_in: [], graded: [] };
    for (const a of assignments) {
      m[(a.lifecycleStatus ?? "to_do") as Lifecycle].push(a);
    }
    return m;
  }, [assignments]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium">
          <span className="mr-2">{emoji}</span>
          {subject.name}
        </h2>
        <span className="text-xs text-muted-foreground">{assignments.length} total</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {LIFECYCLE_COLUMNS.map((col) => (
          <div key={col.key} className="rounded-md border bg-muted/30 p-3 min-h-[120px]">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium">{col.label}</span>
              <span className="text-xs text-muted-foreground">{grouped[col.key].length}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{col.help}</p>
            <div className="space-y-2">
              {grouped[col.key].length === 0 ? (
                <p className="text-xs italic text-muted-foreground">— nothing here —</p>
              ) : (
                grouped[col.key].map((a) => (
                  <AssignmentChip key={a.id} assignment={a} onUpdate={onUpdate} busy={busy} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AssignmentChip({
  assignment,
  onUpdate,
  busy,
}: {
  assignment: any;
  onUpdate: (args: { assignmentId: number; toStatus: Lifecycle }) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const next = NEXT_STATUS[assignment.lifecycleStatus as Lifecycle];

  return (
    <div className="rounded border bg-card p-2 text-sm">
      <div className="font-medium leading-snug truncate" title={assignment.title}>
        {assignment.title}
      </div>
      {assignment.dueAt ? (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
          due {new Date(assignment.dueAt).toLocaleDateString()}
        </div>
      ) : null}
      {assignment.grade ? (
        <Badge variant="secondary" className="mt-1">grade: {assignment.grade}</Badge>
      ) : null}
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {next ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onUpdate({ assignmentId: assignment.id, toStatus: next })}
          >
            Move to {LIFECYCLE_COLUMNS.find((c) => c.key === next)!.label}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          More
        </Button>
      </div>
      {open ? (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {LIFECYCLE_COLUMNS.filter((c) => c.key !== assignment.lifecycleStatus).map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onUpdate({ assignmentId: assignment.id, toStatus: c.key })}
            >
              → {c.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
