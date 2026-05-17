/**
 * TodayClassroomGradedCard
 *
 * Adult-only ("from the teacher") sidekick to TodayClassroomCard.
 *
 * Surfaces the most recently-graded Google Classroom assignments so Mom
 * + Grandma can spot-check what just came back. The kid never sees this
 * widget — caller mounts it inside an `{unlocked && ...}` gate AND the
 * underlying tRPC procedure is `familyAdminProcedure`, so even if the
 * lock state misbehaves, a kid client request would fail-closed and
 * render nothing.
 *
 * Pre-OAuth & pre-applyGradeReturn the result is [] and the card hides
 * entirely. No "no graded work yet" placeholder — that would just be
 * grey-box noise on the dashboard.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

type Row = {
  id: number;
  title: string;
  courseName: string | null;
  grade: string | null;
  gradeNumeric: string | number | null;
  gradedAt: string | Date | null;
  driveFolderId: string | null;
};

function formatGrade(r: Row): string {
  if (r.grade && String(r.grade).trim().length > 0) return String(r.grade);
  if (r.gradeNumeric !== null && r.gradeNumeric !== undefined) {
    const n = Number(r.gradeNumeric);
    if (Number.isFinite(n)) return String(n);
  }
  return "Returned";
}

function formatWhen(r: Row): string {
  if (!r.gradedAt) return "";
  const d = new Date(r.gradedAt);
  if (Number.isNaN(d.getTime())) return "";
  // Calendar-day formatting only — adult-facing, no need for the time.
  return d.toLocaleDateString();
}

export default function TodayClassroomGradedCard() {
  const q = trpc.gclassroom.assignments.recentlyGraded.useQuery(
    { limit: 10 },
    {
      // Adult-pane spot-check feed: refresh on focus so Mom always sees
      // the freshest grade. Stale-while-revalidate at 5 min keeps it
      // responsive without hammering the DB.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  );

  const rows = (q.data ?? []) as Row[];
  if (q.isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <Card
      className="classroom-card p-4"
      data-testid="today-classroom-graded-card"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-lg font-semibold chalk-white">
          Recently graded
        </h2>
        <span className="text-xs text-muted-foreground">
          Google Classroom · adult view
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded border bg-card p-2 text-sm"
            data-testid={`today-classroom-graded-item-${r.id}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div
                className="font-medium leading-snug truncate"
                title={r.title}
              >
                {r.title}
              </div>
              <Badge
                variant="outline"
                className="text-[11px] shrink-0 font-semibold"
                data-testid={`today-classroom-graded-grade-${r.id}`}
              >
                {formatGrade(r)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div className="text-[11px] text-muted-foreground truncate">
                {r.courseName ?? ""}
              </div>
              {r.gradedAt ? (
                <div className="text-[11px] text-muted-foreground shrink-0">
                  {formatWhen(r)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
