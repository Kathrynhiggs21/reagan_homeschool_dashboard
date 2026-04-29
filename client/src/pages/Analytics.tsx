import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import TrajectoryCard from "@/components/TrajectoryCard";
import ParentFlagsBanner from "@/components/ParentFlagsBanner";
import CurrentLevelsFromIep from "@/components/CurrentLevelsFromIep";

function MoodArcChart({ moods }: { moods: any[] }) {
  // Map zone to numeric score (green=2, yellow=1, red=0); render the last 14 entries chronologically
  const data = useMemo(() => {
    const arr = moods.slice(0, 14).reverse();
    return arr.map((m: any) => ({
      label: new Date(m.loggedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      score: m.zone === "green" ? 2 : m.zone === "yellow" ? 1 : 0,
      zone: m.zone,
    }));
  }, [moods]);

  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground italic">No mood data yet — log a few moods on Today.</div>;
  }

  const W = 560, H = 140, pad = 24;
  const stepX = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0;
  const yFor = (s: number) => H - pad - (s / 2) * (H - pad * 2);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${yFor(d.score)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      {[0, 1, 2].map(s => (
        <line key={s} x1={pad} x2={W - pad} y1={yFor(s)} y2={yFor(s)} stroke="oklch(0.88 0.025 70)" strokeDasharray="2 4" />
      ))}
      <text x={4} y={yFor(2) + 4} fontSize="9" fill="oklch(0.5 0.03 60)">green</text>
      <text x={4} y={yFor(1) + 4} fontSize="9" fill="oklch(0.5 0.03 60)">yellow</text>
      <text x={4} y={yFor(0) + 4} fontSize="9" fill="oklch(0.5 0.03 60)">red</text>
      <path d={path} fill="none" stroke="oklch(0.62 0.13 65)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={pad + i * stepX} cy={yFor(d.score)} r={4} fill={d.zone === "green" ? "oklch(0.78 0.13 145)" : d.zone === "yellow" ? "oklch(0.85 0.15 90)" : "oklch(0.7 0.16 25)"} />
          <text x={pad + i * stepX} y={H - 6} fontSize="8" textAnchor="middle" fill="oklch(0.5 0.03 60)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function CoverageChart({ struggles }: { struggles: any[] }) {
  // Bucket struggles by subjectSlug
  const buckets: Record<string, number> = {};
  struggles.forEach(s => {
    const k = s.subjectSlug || "general";
    buckets[k] = (buckets[k] || 0) + 1;
  });
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground italic">Nothing flagged 🌿</div>;
  }
  const max = Math.max(...entries.map(e => e[1]));
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs">
            <span className="capitalize">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-rose-300" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const overview = trpc.analytics.wellness.useQuery({});
  const skills = trpc.skills.list.useQuery();
  const struggles = trpc.struggles.list.useQuery({});
  const moods = trpc.mood.recent.useQuery({ daysBack: 14 });
  const subjectGrades = trpc.submissions.subjectGrades.useQuery();
  const iepGoals = trpc.iep.listGoals.useQuery();
  const iepAccoms = trpc.iep.listAccommodations.useQuery();
  const screenings = trpc.iep.listScreenings.useQuery();
  const recentSubmissions = trpc.submissions.list.useQuery({ limit: 10 });

  // Dedupe IEP goals + accommodations by normalized text (server bug ANALYTICS-DUP-1/2 — same row was being inserted twice across migrations)
  const uniqueGoals = useMemo(() => {
    const seen = new Set<string>();
    return ((iepGoals.data as any[]) || []).filter((g) => {
      const key = String(g.goalText || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [iepGoals.data]);
  const uniqueAccoms = useMemo(() => {
    const seen = new Set<string>();
    return ((iepAccoms.data as any[]) || []).filter((a) => {
      const key = String(a.accommodationText || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [iepAccoms.data]);

  // Hide placeholder grade card (subjectSlug 'general') — bug ANALYTICS-PLACEHOLDER-GRADE
  const realSubjectGrades = useMemo(() => {
    return ((subjectGrades.data as any[]) || []).filter((g) => {
      const slug = String(g.subjectSlug || "").toLowerCase();
      return slug && slug !== "general";
    });
  }, [subjectGrades.data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Analytics 📊</h1>
        <p className="text-muted-foreground text-sm mt-1">For adults — Reagan's growth, patterns, and where she needs support. Never shown to her.</p>
      </header>

      {/* Adaptation engine v2 — surfaces stacked-struggle alerts (parent only) */}
      <ParentFlagsBanner />

      {/* Catch-up trajectory: Reagan's path back to grade level + IEP exit indicators */}
      <TrajectoryCard />

      {/* Current levels derived from IEP present-levels + latest screenings (parent-visible only) */}
      <CurrentLevelsFromIep
        goals={uniqueGoals as any[]}
        screenings={(screenings.data as any[]) || []}
      />

      <Card className="cozy-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold">Subject grades (last 30 days)</h2>
          <div className="text-[10px] text-muted-foreground">Rolling avg of auto-graded turn-ins (70%) + block completion grades (30%)</div>
        </div>
        {realSubjectGrades.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No grades yet. Once Reagan turns in an assignment with an answer key, numbers appear here.</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {realSubjectGrades.map((g) => (
              <div key={g.subjectSlug} className="p-3 rounded-md border bg-white/40">
                <div className="flex items-baseline justify-between">
                  <div className="capitalize font-semibold">{g.subjectSlug}</div>
                  <div className="text-2xl font-display font-semibold">{g.letter}</div>
                </div>
                <div className="text-xs text-muted-foreground">{g.average}% — {g.kidLabel} · {g.n} item{g.n === 1 ? "" : "s"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Anxiety score (7d)</div>
          <div className="text-3xl font-display font-semibold mt-1">{(overview.data as any)?.anxietyScore ?? 0}</div>
          <div className="text-[10px] text-muted-foreground">0 = calm · 100 = high</div>
        </Card>
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Depression score (7d)</div>
          <div className="text-3xl font-display font-semibold mt-1">{(overview.data as any)?.depressionScore ?? 0}</div>
          <div className="text-[10px] text-muted-foreground">trend: {(overview.data as any)?.trendArrow || "steady"}</div>
        </Card>
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Severity</div>
          <div className="text-3xl font-display font-semibold mt-1 capitalize">{(overview.data as any)?.severity || "green"}</div>
        </Card>
      </div>

      <Card className="cozy-card p-4">
        <h2 className="font-display font-semibold mb-3">Mood Arc — last 14 logs</h2>
        <MoodArcChart moods={moods.data || []} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="cozy-card p-4">
          <h2 className="font-display font-semibold mb-3">Skills Mastery</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {skills.data?.map((sk: any) => (
              <div key={sk.id}>
                <div className="flex justify-between text-sm">
                  <span>{sk.skillName} <span className="text-xs text-muted-foreground">({sk.subjectSlug || sk.subjectId})</span></span>
                  <span className="font-mono text-xs">{sk.currentScore || 0}%</span>
                </div>
                <Progress value={sk.currentScore || 0} className="h-2 mt-1" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="cozy-card p-4">
          <h2 className="font-display font-semibold mb-3">Struggle hotspots (by subject)</h2>
          <CoverageChart struggles={struggles.data || []} />
        </Card>
      </div>

      {/* ============ IEP Goals & Accommodations (RHiggs 2025-26 IEP.pdf) ============ */}
      <Card className="cozy-card p-4 border-l-4" style={{ borderLeftColor: 'oklch(0.78 0.16 340)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-display font-semibold text-xl">IEP Goals &amp; Accommodations</h2>
            <p className="text-xs text-muted-foreground mt-1">Source: RHiggs 2025-26 IEP.pdf · Originating district: Madeira City SD · Currently implemented at: Indian Hill EVSD (5th grade, 2025-26) · OHI (anxiety) · Effective 2/19/2025 &ndash; 2/17/2026 · Next ETR 2/17/2028</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-1 rounded-full bg-rose-200/40 text-rose-900 border border-rose-300">OHI</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-200/40 text-amber-900 border border-amber-300">Anxiety</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-sky-200/40 text-sky-900 border border-sky-300">5th grade</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-200/40 text-emerald-900 border border-emerald-300">Next ETR 2/17/2028</span>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
              <span className="text-base">🎯</span> Measurable Annual Goals
              <span className="text-[10px] text-muted-foreground">({uniqueGoals.length})</span>
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {uniqueGoals.map((g: any) => (
                <div key={g.id} className="p-3 rounded-md border bg-white/40">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-900 border border-violet-200 capitalize">{g.area}</span>
                    {g.subjectSlug && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200 capitalize">{g.subjectSlug}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 capitalize">{String(g.status || '').replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm font-medium">{g.goalText}</div>
                  {g.presentLevel && <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold">Present level:</span> {g.presentLevel}</div>}
                  {g.targetCriterion && <div className="text-xs text-muted-foreground mt-1"><span className="font-semibold">Target:</span> {g.targetCriterion}</div>}
                  {g.measuredBy && <div className="text-[10px] text-muted-foreground mt-1 italic">Measured by: {g.measuredBy}</div>}
                </div>
              ))}
              {uniqueGoals.length === 0 && (
                <div className="text-sm text-muted-foreground italic p-3">No IEP goals loaded.</div>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
              <span className="text-base">🛡️</span> Active Accommodations
              <span className="text-[10px] text-muted-foreground">({uniqueAccoms.length})</span>
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {uniqueAccoms.map((a: any) => (
                <div key={a.id} className="p-3 rounded-md border bg-white/40">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 capitalize shrink-0 mt-0.5">{a.category}</span>
                    <div className="flex-1">
                      <div className="text-sm">{a.accommodationText}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                        {a.subjectSlug && <span className="capitalize">{a.subjectSlug}</span>}
                        {a.frequency && <span>&middot; {a.frequency}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {uniqueAccoms.length === 0 && (
                <div className="text-sm text-muted-foreground italic p-3">No accommodations loaded.</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Submissions — every Reagan submission lands here, NEVER pushed to Google Classroom */}
      <Card className="cozy-card p-4 border-l-4" style={{ borderLeftColor: 'oklch(0.7 0.15 25)' }}>
        <div className="mb-3">
          <h2 className="font-display font-semibold text-xl">Recent Submissions</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Every photo, typed answer, drawing, and recording Reagan submits lands here for your review.
            Submissions are <strong>never</strong> auto-pushed to Google Classroom — Mom decides what goes back to the school.
          </p>
        </div>
        {recentSubmissions.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : ((recentSubmissions.data as any[]) || []).length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No submissions yet.</div>
        ) : (
          <div className="divide-y">
            {((recentSubmissions.data as any[]) || []).map((s) => {
              const when = new Date(s.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              const typeIcon = s.submissionType === "photo" ? "📷" : s.submissionType === "audio" ? "🎙️" : s.submissionType === "file" ? "📎" : "📝";
              const status = s.reviewStatus || "pending";
              const statusBadge: Record<string, string> = {
                pending: "bg-amber-100 text-amber-900",
                reviewed: "bg-emerald-100 text-emerald-900",
                retry: "bg-rose-100 text-rose-900",
                flagged: "bg-purple-100 text-purple-900",
              };
              return (
                <div key={s.id} className="flex items-start gap-3 py-2">
                  <div className="text-2xl shrink-0">{typeIcon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.title || `Block #${s.blockId}`}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{when}</span>
                      {s.subjectSlug && <><span>·</span><span className="capitalize">{s.subjectSlug}</span></>}
                      <span>·</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge[status] || "bg-muted"}`}>
                        {status}
                      </span>
                    </div>
                    {s.contentText && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.contentText}</div>
                    )}
                  </div>
                  {s.fileUrl && (
                    <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline shrink-0">
                      Open
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Screening history (Reagan handoff Apr 2026) */}
      {((screenings.data as any[]) || []).length > 0 && (
        <Card className="cozy-card p-4 border-l-4" style={{ borderLeftColor: 'oklch(0.78 0.15 220)' }}>
          <div className="mb-3">
            <h2 className="font-display font-semibold text-xl">Screening History</h2>
            <p className="text-xs text-muted-foreground mt-1">Acadience ORF, MAZE, NWEA MAP Math, decoding, writing — from 2024-25 IEP &amp; 2025 Reevaluation.</p>
          </div>
          {(() => {
            const groups = new Map<string, any[]>();
            for (const s of (screenings.data as any[]) || []) {
              const key = s.testFamily;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(s);
            }
            const TITLES: Record<string, string> = {
              acadience_orf: "Acadience ORF (Oral Reading Fluency)",
              maze: "MAZE Reading Comprehension",
              nwea_map_math: "NWEA MAP Math",
              decoding: "Decoding probes",
              writing: "Writing mechanics",
            };
            return (
              <div className="space-y-3">
                {Array.from(groups.entries()).map(([family, rows]) => (
                  <div key={family}>
                    <div className="text-sm font-semibold mb-1 capitalize">{TITLES[family] || family}</div>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b">
                            <th className="py-1 pr-3">Window</th>
                            <th className="py-1 pr-3">Metric</th>
                            <th className="py-1 pr-3">Value</th>
                            <th className="py-1 pr-3">Target</th>
                            <th className="py-1 pr-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r: any) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="py-1 pr-3">{r.windowLabel || "—"}</td>
                              <td className="py-1 pr-3">{r.metric}</td>
                              <td className="py-1 pr-3 font-semibold">{r.value}</td>
                              <td className="py-1 pr-3 text-muted-foreground">{r.targetValue || "—"}</td>
                              <td className="py-1 pr-3 text-muted-foreground">{r.notes || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      <Card className="cozy-card p-4">
        <h2 className="font-display font-semibold mb-3">Recent Emotional Struggles</h2>
        <div className="space-y-2">
          {(struggles.data ?? []).slice(0, 10).map((s: any) => (
            <div key={s.id} className="text-sm flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <span className={`w-2 h-2 rounded-full mt-2 ${s.intensity === "red" ? "bg-rose-500" : s.intensity === "yellow" ? "bg-amber-400" : "bg-emerald-400"}`}/>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{new Date(s.loggedAt).toLocaleDateString()} · {s.subjectSlug || "general"}</div>
                {s.description && <div>{s.description}</div>}
              </div>
            </div>
          ))}
          {struggles.data?.length === 0 && <div className="text-sm text-muted-foreground italic">No struggles logged. ✨</div>}
        </div>
      </Card>
    </div>
  );
}
