import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, TrendingUp, Heart, AlertTriangle, GraduationCap, BookOpen, Eye } from "lucide-react";

const SUBJECT_LABEL: Record<string, string> = {
  math: "Math",
  ela: "ELA / Reading",
  science: "Science",
  socialStudies: "Social Studies",
  social_studies: "Social Studies",
  other: "Other",
};

const HELPER_LABEL: Record<string, string> = {
  story: "story / context",
  visual: "visual",
  handsOn: "hands-on",
  watch: "watch a video",
  practice: "more practice",
  kiwiTalk: "talked it out with Kiwi",
  tutor: "tutor session",
  movement: "movement break",
};

export default function WeeklyDigestCard() {
  const [showPreview, setShowPreview] = useState(false);
  // preview = the *current* week so far (live, before Sunday's email)
  const preview = trpc.digest.preview.useQuery();
  // recent = the rows actually saved by Sunday scheduled task
  const recent = trpc.digest.recent.useQuery({ limit: 4 });
  // HTML preview — only fetched when Mom/Grandma click Preview email
  const previewHtml = trpc.digest.previewHtml.useQuery(
    { summerActive: false },
    { enabled: showPreview },
  );

  const p = preview.data as any;
  const lastSaved = (recent.data ?? [])[0] as any;

  const weekRange = p?.weekStart
    ? `${new Date(p.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(p.weekEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "this week";

  const lastEmailedStr = lastSaved?.emailedAt
    ? new Date(lastSaved.emailedAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  // Empty state if nothing has happened all week and never emailed
  const hasAnything =
    p && (
      (p.levelUps?.length ?? 0) > 0 ||
      (p.tutorSessionsCount ?? 0) > 0 ||
      (p.flagsCount ?? 0) > 0 ||
      (p.moodArc?.total ?? 0) > 0 ||
      (p.whatHelped?.length ?? 0) > 0
    );

  return (
    <Card className="p-5 border-2 border-emerald-300/30 bg-gradient-to-br from-emerald-500/5 via-blue-500/5 to-purple-500/5">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-300" />
            This Week — Reagan&rsquo;s Digest
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {weekRange} · auto-emails to <code>spear.cpt@gmail.com</code> and <code>marcy.spear@gmail.com</code> every Sunday at 7&nbsp;PM.
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          {lastEmailedStr ? (
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/40">Last sent: {lastEmailedStr}</Badge>
          ) : (
            <Badge variant="secondary">No digest sent yet — first one goes Sunday 7&nbsp;PM</Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="bg-background/40"
            onClick={() => setShowPreview((v) => !v)}
            data-testid="digest-preview-toggle"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            {showPreview ? "Hide email preview" : "Preview email"}
          </Button>
        </div>
      </header>

      {showPreview && (
        <div className="mb-4 rounded-md border border-white/10 bg-background/40 overflow-hidden" data-testid="digest-html-preview">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-white/10 flex items-center justify-between">
            <span>Email preview — not yet sent. Mom + Grandma both receive this.</span>
            {previewHtml.data?.recipients && (
              <span className="opacity-80">To: {previewHtml.data.recipients.join(", ")}</span>
            )}
          </div>
          {previewHtml.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Rendering email…</div>
          ) : previewHtml.data?.html ? (
            <iframe
              title="Sunday digest preview"
              srcDoc={previewHtml.data.html}
              className="w-full h-[480px] bg-white"
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground italic">No preview available.</div>
          )}
        </div>
      )}

      {preview.isLoading && (
        <div className="text-sm text-muted-foreground">Loading this week&hellip;</div>
      )}

      {!preview.isLoading && !hasAnything && (
        <div className="text-sm text-muted-foreground italic">
          Nothing recorded this week yet. Once Reagan practices, gets tutored, or has a mood signal, it will show up here.
        </div>
      )}

      {!preview.isLoading && hasAnything && p && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* LEVEL-UPS */}
          <Section
            icon={<TrendingUp className="w-4 h-4 text-yellow-300" />}
            title={`Level-ups (${p.levelUps?.length ?? 0})`}
          >
            {(p.levelUps?.length ?? 0) === 0 ? (
              <Empty>No new level-ups this week.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {p.levelUps.slice(0, 6).map((l: any, i: number) => (
                  <li key={i} className="text-foreground/90">
                    <span className="font-medium">{l.title || "(level-up)"}</span>
                    {l.category ? <span className="text-muted-foreground"> · {l.category}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* TUTOR SESSIONS */}
          <Section
            icon={<GraduationCap className="w-4 h-4 text-blue-300" />}
            title={`Tutor sessions (${p.tutorSessionsCount ?? 0})`}
          >
            {(p.tutorSessions?.length ?? 0) === 0 ? (
              <Empty>No tutor sessions completed this week.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {p.tutorSessions.slice(0, 4).map((t: any, i: number) => (
                  <li key={i} className="text-foreground/90">
                    {t.focus || "(focus not noted)"}
                    {t.when ? <span className="text-muted-foreground"> · {new Date(t.when).toLocaleDateString()}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* MOOD ARC */}
          <Section
            icon={<Heart className="w-4 h-4 text-pink-300" />}
            title={`Mood arc (${p.moodArc?.total ?? 0} signals)`}
          >
            {(p.moodArc?.total ?? 0) === 0 ? (
              <Empty>No mood signals this week.</Empty>
            ) : (
              <div className="flex gap-2 text-sm">
                <Pill color="emerald">Easy: {p.moodArc.easy}</Pill>
                <Pill color="amber">OK: {p.moodArc.ok}</Pill>
                <Pill color="rose">Hard: {p.moodArc.hard}</Pill>
              </div>
            )}
          </Section>

          {/* WHAT HELPED */}
          <Section
            icon={<BookOpen className="w-4 h-4 text-purple-300" />}
            title="What helped most"
          >
            {(p.whatHelped?.length ?? 0) === 0 ? (
              <Empty>No feedback yet.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {p.whatHelped.map((w: any, i: number) => (
                  <li key={i} className="text-foreground/90">
                    {HELPER_LABEL[w.helper] ?? w.helper}
                    <span className="text-muted-foreground"> · {w.count}x</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* SUBJECT CONFIDENCE */}
          {(p.subjectSummary?.length ?? 0) > 0 && (
            <Section
              icon={<TrendingUp className="w-4 h-4 text-cyan-300" />}
              title="Subject confidence (so far)"
            >
              <ul className="space-y-1 text-sm">
                {p.subjectSummary.map((s: any, i: number) => (
                  <li key={i} className="text-foreground/90 flex items-center justify-between">
                    <span>{SUBJECT_LABEL[s.subject] ?? s.subject}</span>
                    <span className="text-muted-foreground">
                      avg lvl {s.avgLevel} · conf {s.avgConfidence}% · {s.skillsTracked} skills
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* FLAGS */}
          {(p.flagsCount ?? 0) > 0 && (
            <Section
              icon={<AlertTriangle className="w-4 h-4 text-amber-300" />}
              title={`Parent flags raised (${p.flagsCount})`}
            >
              <ul className="space-y-1 text-sm">
                {p.flags.slice(0, 4).map((f: any, i: number) => (
                  <li key={i} className="text-foreground/90">
                    <span className="font-medium">{f.kind}</span>
                    <span className="text-muted-foreground"> · {f.summary}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* RECENT DIGESTS */}
      {(recent.data?.length ?? 0) > 0 && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent digests</h3>
          <ul className="space-y-1 text-sm">
            {(recent.data ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="text-foreground/90">
                  Week of {new Date(d.weekStart).toLocaleDateString()}
                </span>
                <Badge variant="secondary" className={d.emailStatus === "sent" ? "bg-emerald-500/20 text-emerald-200" : d.emailStatus === "failed" ? "bg-rose-500/20 text-rose-200" : ""}>
                  {d.emailStatus ?? "pending"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-background/30 p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic">{children}</div>;
}

function Pill({ color, children }: { color: "emerald" | "amber" | "rose"; children: React.ReactNode }) {
  const cls =
    color === "emerald" ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
    : color === "amber" ? "bg-amber-500/20 text-amber-200 border-amber-500/30"
    : "bg-rose-500/20 text-rose-200 border-rose-500/30";
  return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{children}</span>;
}
