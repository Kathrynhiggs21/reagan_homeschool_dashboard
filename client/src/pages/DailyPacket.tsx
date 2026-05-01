import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopicLabel from "@/components/TopicLabel";
import { findAllPrintablesForSubject, detectSubjectSlug } from "@/lib/matchPrintable";

/**
 * Adult-only "Daily Packet" view. Single page that:
 *  - lists every block for today,
 *  - lists every printable that matches each block,
 *  - is print-ready (browser Print → packet).
 *
 * Print stylesheet hides the page chrome and forces a clean black-on-white
 * layout so Reagan's adult can hand her a paper version of the day.
 */
export default function DailyPacket() {
  const today = trpc.plans.today.useQuery();
  const sw = trpc.printables.today.useQuery();
  const blocks: any[] = (today.data as any)?.blocks ?? [];
  const items: any[] = [
    ...((sw.data as any)?.have_to_do ?? []),
    ...((sw.data as any)?.optional ?? []),
    ...((sw.data as any)?.extra ?? []),
  ];
  const dateStr = (today.data as any)?.date
    ? new Date((today.data as any).date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div className="container py-6 print:py-0 print:px-0">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          aside, header, nav { display: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #999 !important; break-inside: avoid; }
          a { color: black !important; text-decoration: underline; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold">Daily Packet</h1>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
        <Button onClick={() => window.print()} className="bg-amber-500 hover:bg-amber-400 text-amber-950">
          Print packet
        </Button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Reagan&rsquo;s Daily Packet &mdash; {dateStr}</h1>
      </div>

      {today.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading today&rsquo;s plan&hellip;</div>
      ) : blocks.length === 0 ? (
        <Card className="p-6 print-card">
          <p className="text-sm">Nothing scheduled for today yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b: any, i: number) => {
            const slug = detectSubjectSlug(b);
            const matches = findAllPrintablesForSubject(items as any, slug, 6);
            return (
              <li key={b.id ?? i}>
                <Card className="p-4 print-card">
                  <div className="flex items-start gap-3">
                    <Badge className="capitalize mt-0.5">{b.subjectSlug || b.kind || "block"}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg">{b.title}</div>
                      <div className="mt-1">
                        <TopicLabel
                          subjectSlug={b.subjectSlug}
                          topicName={b.curriculumTopicName ?? null}
                          size="xs"
                        />
                      </div>
                      {b.description && (
                        <p className="text-sm mt-2 leading-snug">{b.description}</p>
                      )}
                      {matches.length > 0 ? (
                        <div className="mt-3">
                          <div className="text-[11px] uppercase tracking-wide font-bold opacity-70">
                            Worksheets &amp; files
                          </div>
                          <ul className="mt-1 space-y-1 text-sm">
                            {matches.map((m: any) => (
                              <li key={m.id} className="flex items-center gap-2">
                                <span aria-hidden="true">
                                  {m.pdfKey ? "\ud83d\udcc4" : m.thumbKey ? "\ud83d\uddbc\ufe0f" : "\u270f\ufe0f"}
                                </span>
                                <span>{m.title}</span>
                                {m.status === "done" && <span className="text-emerald-600">✓ done</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground italic">
                          No matching printable on file. (Use a free-link suggestion or paper from binder.)
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
