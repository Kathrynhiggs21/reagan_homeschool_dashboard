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
          /* Each worksheet page starts on its own paper sheet */
          .worksheet-page { page-break-before: always; break-before: page; }
          .answer-line { border-bottom: 1px solid #333; height: 28px; }
          .answer-box  { border: 1px solid #333; min-height: 110px; border-radius: 4px; }
          .turnin-note { border: 2px dashed #333; padding: 8px 12px; border-radius: 6px; }
        }
        /* Screen preview: still show the paper pages but a touch lighter */
        .worksheet-page { margin-top: 32px; padding-top: 16px; border-top: 2px dashed #ccc; }
        .answer-line { border-bottom: 1px solid #555; height: 28px; margin: 6px 0; }
        .answer-box  { border: 1px solid #555; min-height: 110px; border-radius: 4px; margin-top: 6px; }
        .turnin-note { border: 2px dashed #555; padding: 8px 12px; border-radius: 6px; margin-top: 8px; font-size: 13px; }
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

      {/* Quick "how to turn it in" note (printed once at the top of the packet) */}
      <div className="turnin-note no-print:hidden mb-4">
        <strong>How to turn in paper work:</strong> Reagan, when you finish a worksheet, take
        a clear photo of the page with the iPad camera, then open the dashboard and tap
        <em> Apps &amp; Tools → Snap a photo to turn in</em>. Mom will see it in the Library.
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
                      {Array.isArray(b.pageRefs) && b.pageRefs.length > 0 && (
                        <ul className="mt-2 text-sm space-y-0.5">
                          {b.pageRefs.map((pr: any, idx: number) => (
                            <li key={`${pr.bookId}-${idx}`} className="flex items-center gap-1">
                              <span aria-hidden="true">📖</span>
                              <span className="font-semibold">{pr.bookTitle || "Reading"}</span>
                              <span className="opacity-80">· pg {pr.fromPage}{pr.toPage && pr.toPage !== pr.fromPage ? `–${pr.toPage}` : ""}</span>
                              {pr.notes ? <span className="opacity-70"> — {pr.notes}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
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

      {/* ============================================================
          PAPER WORKSHEET PAGES
          One sheet per block, with a header row, the topic, and either:
            - lined answer space (for written/short-answer subjects), or
            - a big answer box (for math / drawing).
          Each page also reminds Reagan how to snap a photo to turn it in.
         ============================================================ */}
      {blocks.length > 0 && (
        <div>
          {blocks.map((b: any, i: number) => {
            const slug = detectSubjectSlug(b);
            const isMathish = /math|geom|measure|fraction|number|stem|science/i.test(
              slug || ""
            );
            return (
              <section key={`page-${b.id ?? i}`} className="worksheet-page">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide opacity-60">
                      {dateStr}
                    </div>
                    <h2 className="text-xl font-bold">
                      {i + 1}. {b.title}
                    </h2>
                    <div className="mt-1">
                      <TopicLabel
                        subjectSlug={b.subjectSlug}
                        topicName={b.curriculumTopicName ?? null}
                        size="xs"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    <div>Name: ____________________</div>
                    <div className="mt-1">Time: ______ : ______</div>
                  </div>
                </div>

                {b.description && (
                  <p className="text-sm leading-snug mb-3">
                    <strong>What to do:</strong> {b.description}
                  </p>
                )}

                {/* Answer area — either lined or a big box */}
                {isMathish ? (
                  <>
                    <div className="text-[11px] uppercase tracking-wide font-bold opacity-70 mb-1">
                      Show your work
                    </div>
                    <div className="answer-box" />
                    <div className="answer-box mt-3" />
                  </>
                ) : (
                  <>
                    <div className="text-[11px] uppercase tracking-wide font-bold opacity-70 mb-1">
                      Your answer
                    </div>
                    {Array.from({ length: 12 }).map((_, k) => (
                      <div key={k} className="answer-line" />
                    ))}
                  </>
                )}

                <div className="turnin-note mt-4">
                  <strong>Done?</strong> 📸 Take a photo of this page on the iPad,
                  then open the dashboard and tap <em>Apps &amp; Tools → Snap a photo
                  to turn in</em>. Mom will see it in the Library.
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
