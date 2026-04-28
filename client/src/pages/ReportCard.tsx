/**
 * ReportCard — adult-only printable view of per-subject rolling grades.
 * Pulls grades.rolling for every subject + recent block grades for context.
 * Print-friendly: hides chrome and uses high-contrast layout.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SubjectGrade {
  slug: string;
  name: string;
  color: string;
  emoji: string;
  score: number | null;
  letter: string | null;
  count: number;
}

function kidLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 90) return "Mastered";
  if (score >= 75) return "Got it";
  if (score >= 50) return "Getting there";
  return "Not yet";
}

export default function ReportCard() {
  const subjects = trpc.subjects.list.useQuery();
  const utils = trpc.useUtils();
  const [grades, setGrades] = useState<SubjectGrade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subjects.data) return;
    setLoading(true);
    Promise.all(
      (subjects.data as any[]).map(async (s) => {
        const g: any = await utils.grades.rolling.fetch({ subjectSlug: s.slug });
        return { slug: s.slug, name: s.name, color: s.color, emoji: s.emoji, ...g } as SubjectGrade;
      })
    ).then((rows) => { setGrades(rows); setLoading(false); });
  }, [subjects.data, utils.grades.rolling]);

  const printedAt = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-5 print:bg-white print:text-black">
      <header className="flex items-end justify-between gap-3 flex-wrap print:hidden">
        <div className="chalkboard">
          <div className="font-chalk-hand text-xl chalk-yellow">Adult-only printable</div>
          <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Report Card</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rolling per-subject grades from completed work and adult-graded blocks.
          </p>
        </div>
        <Button onClick={() => window.print()}>🖨 Print</Button>
      </header>

      {/* Print-only header */}
      <div className="hidden print:block">
        <div className="text-2xl font-bold">Reagan — Report Card</div>
        <div className="text-sm">{printedAt}</div>
        <hr className="my-3 border-black" />
      </div>

      <Card className="classroom-card p-5 print:p-0 print:shadow-none print:border-0">
        {loading && <div className="text-muted-foreground text-sm">Loading…</div>}
        {!loading && grades.length === 0 && (
          <div className="text-sm text-muted-foreground">No subjects configured yet.</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border print:border-black text-left">
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Average</th>
                <th className="py-2 pr-3">Letter</th>
                <th className="py-2 pr-3">Kid label</th>
                <th className="py-2 pr-3 text-right">Graded blocks</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.slug} className="border-b border-border/60 print:border-black/40">
                  <td className="py-2 pr-3">
                    <span className="mr-2">{g.emoji}</span>
                    <span className="font-medium">{g.name}</span>
                  </td>
                  <td className="py-2 pr-3">{g.score ?? "—"}{g.score !== null ? "%" : ""}</td>
                  <td className="py-2 pr-3 font-display text-base">{g.letter ?? "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground print:text-black/70">{kidLabel(g.score)}</td>
                  <td className="py-2 pr-3 text-right">{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground print:text-black/70">
        Generated {printedAt}. Reagan never sees this view — only the friendly kid label.
      </p>
    </div>
  );
}
