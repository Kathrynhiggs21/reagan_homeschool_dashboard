import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Shows the most recent Indian Hill PowerSchool grades + assignments that have
 * been imported (via Settings paste/CSV or the scheduled scraper). Parent-only.
 */
export default function PowerSchoolGradesCard() {
  const grades = trpc.powerschool.listGrades.useQuery({ limit: 20 });
  const assignments = trpc.powerschool.listAssignments.useQuery({ limit: 20 });
  const imports = trpc.powerschool.listImports.useQuery({ limit: 3 });

  const gRows = (grades.data as any[]) || [];
  const aRows = (assignments.data as any[]) || [];
  const iRows = (imports.data as any[]) || [];

  const hasAny = gRows.length > 0 || aRows.length > 0 || iRows.length > 0;

  // Per user request 2026-05-05: don't render an empty PowerSchool placeholder
  // card on the Analytics page — if there's no data, the card just goes away.
  // The import path lives in Settings → PowerSchool, no need to advertise it
  // on the analytics surface.
  if (!hasAny) return null;

  return (
    <Card className="cozy-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-semibold">PowerSchool (Indian Hill)</h2>
          <div className="text-[11px] text-muted-foreground">
            Most-recent imported grades + assignments. Imports run via Settings or the daily scheduler.
          </div>
        </div>
        {iRows[0] ? (
          <Badge variant="outline" className="text-xs">
            Last import · {new Date(iRows[0].importedAt).toLocaleDateString()} · {iRows[0].parsedCount} rows
          </Badge>
        ) : null}
      </div>

      {(
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
              Latest class grades
            </div>
            {gRows.length === 0 ? (
              <div className="text-xs italic text-muted-foreground">No class-level grades parsed yet.</div>
            ) : (
              <ul className="space-y-1">
                {gRows.slice(0, 8).map((g: any) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between p-2 rounded-md bg-white/40 border"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{g.course}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {g.teacher || "—"} · {g.term}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-xl leading-none">{g.letter ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{g.percent ? `${g.percent}%` : ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
              Recent assignments
            </div>
            {aRows.length === 0 ? (
              <div className="text-xs italic text-muted-foreground">No assignments parsed yet.</div>
            ) : (
              <ul className="space-y-1">
                {aRows.slice(0, 8).map((a: any) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between p-2 rounded-md bg-white/40 border"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {a.course} · {a.category || "—"}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold">
                        {a.score ?? "—"}
                        {a.pointsPossible ? `/${a.pointsPossible}` : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{a.status ?? ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
