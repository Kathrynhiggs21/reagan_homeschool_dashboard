/**
 * TodayClassroomCard
 *
 * Small, self-contained card that surfaces Reagan's *active* Google
 * Classroom assignments on the Today page (lifecycle in to_do or
 * in_progress, due in the next week or open-ended). Uses the reusable
 * `LifecycleChip` so the kid can move work without leaving Today.
 *
 * Pre-OAuth state: the underlying tRPC query returns []. This component
 * renders nothing in that case, so dropping it onto Today is strictly
 * additive — no UI noise until Mom grants the Classroom scope.
 *
 * Mom/Grandma-only mutations: the chip calls
 * `gclassroom.assignments.updateStatus` which is gated by
 * familyAdminProcedure. If a non-admin somehow taps it, the server
 * rejects and we surface a toast.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifecycleChip } from "@/components/LifecycleChip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ClassroomLifecycle } from "@shared/classroomLifecycleUI";

export default function TodayClassroomCard() {
  const utils = trpc.useUtils();
  const q = trpc.gclassroom.assignments.activeForToday.useQuery(
    { windowDays: 7, limit: 12 },
    {
      // Don't hammer the DB on every Today page render; this is a
      // background "what's pending" feed, hourly is plenty.
      staleTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );
  const updateStatus = trpc.gclassroom.assignments.updateStatus.useMutation({
    onSuccess: () => {
      utils.gclassroom.assignments.activeForToday.invalidate();
      utils.gclassroom.assignments.byLifecycle.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "Couldn't move that assignment.");
    },
  });

  // Hide entire card while loading the first time + when the result is empty.
  // This is what keeps it strictly additive on the kid-facing Today page.
  const rows = (q.data ?? []) as any[];
  if (q.isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="classroom-card p-4" data-testid="today-classroom-card">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-lg font-semibold chalk-white">
          From your teachers
        </h2>
        <span className="text-xs text-muted-foreground">
          Google Classroom · this week
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map((a: any) => (
          <div
            key={a.id}
            className="rounded border bg-card p-2 text-sm"
            data-testid={`today-classroom-item-${a.id}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div
                className="font-medium leading-snug truncate"
                title={a.title}
              >
                {a.title}
              </div>
              {a.dueAt ? (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  due {new Date(a.dueAt).toLocaleDateString()}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  open
                </Badge>
              )}
            </div>
            {a.courseName ? (
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {a.courseName}
              </div>
            ) : null}
            <div className="mt-2">
              <LifecycleChip
                status={(a.lifecycleStatus ?? "to_do") as ClassroomLifecycle}
                disabled={updateStatus.isPending}
                compact
                testId={`lifecycle-chip-today-${a.id}`}
                onChange={(target) =>
                  updateStatus.mutate({
                    assignmentId: a.id,
                    toStatus: target,
                    changedBy: "reagan",
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
