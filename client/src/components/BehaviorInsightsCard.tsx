import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Brain, TrendingUp, Lightbulb, Target, Smile, Frown, Meh, CheckCircle2 } from "lucide-react";

/** Mood zone → color + icon */
function MoodDot({ zone }: { zone: string }) {
  if (zone === "green") return <span className="inline-block w-3 h-3 rounded-full bg-emerald-400" title="Green zone" />;
  if (zone === "yellow") return <span className="inline-block w-3 h-3 rounded-full bg-amber-400" title="Yellow zone" />;
  if (zone === "red") return <span className="inline-block w-3 h-3 rounded-full bg-rose-500" title="Red zone" />;
  if (zone === "black") return <span className="inline-block w-3 h-3 rounded-full bg-gray-800" title="Black zone" />;
  return <span className="inline-block w-3 h-3 rounded-full bg-gray-300" title="No data" />;
}

function MoodIcon({ ratio }: { ratio: number }) {
  if (ratio >= 0.7) return <Smile className="w-5 h-5 text-emerald-400" />;
  if (ratio >= 0.4) return <Meh className="w-5 h-5 text-amber-400" />;
  return <Frown className="w-5 h-5 text-rose-400" />;
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function BehaviorInsightsCard() {
  const wellnessQ = trpc.analytics.wellness.useQuery({ daysBack: 7 });
  const moodQ = trpc.mood.recent.useQuery({ daysBack: 7 });
  const strugglesQ = trpc.struggles.list.useQuery({ daysBack: 30 });
  const knowledgeQ = trpc.knowledge.list.useQuery({ activeOnly: true });
  const focusQ = trpc.analytics.blockCompletionStats.useQuery({ daysBack: 7 });

  const wellness = wellnessQ.data;
  const moods: any[] = moodQ.data ?? [];
  const struggles: any[] = strugglesQ.data ?? [];
  const knowledge: any[] = knowledgeQ.data ?? [];

  /** Group moods by date for the 7-day arc */
  const moodArc = useMemo(() => {
    const byDate: Record<string, string[]> = {};
    for (const m of moods) {
      const d = new Date(m.loggedAt ?? m.createdAt ?? Date.now()).toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(m.zone);
    }
    // Last 7 days
    const days: { date: string; zone: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const zones = byDate[d] ?? [];
      // Pick worst zone for the day
      const zone = zones.includes("black") ? "black"
        : zones.includes("red") ? "red"
        : zones.includes("yellow") ? "yellow"
        : zones.includes("green") ? "green"
        : "none";
      days.push({ date: d, zone });
    }
    return days;
  }, [moods]);

  /** Struggle trends by subject */
  const struggleTrends = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of struggles) {
      const subj = s.subjectSlug || "general";
      counts[subj] = (counts[subj] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([subject, count]) => ({ subject, count }));
  }, [struggles]);

  /** Learning style profile from knowledge insights */
  const learningProfile = useMemo(() => {
    const strengths = knowledge.filter(k => k.insightType === "academic_strength").slice(0, 3);
    const accommodations = knowledge.filter(k => k.insightType === "accommodation").slice(0, 3);
    const preferences = knowledge.filter(k => k.insightType === "preference").slice(0, 2);
    const interests = knowledge.filter(k => k.insightType === "interest").slice(0, 2);
    return { strengths, accommodations, preferences, interests };
  }, [knowledge]);

  const focusStats = focusQ.data;

  const isLoading = wellnessQ.isLoading || moodQ.isLoading;
  const hasAnyData = wellness || moods.length > 0 || struggles.length > 0 || knowledge.length > 0;

  if (isLoading) {
    return (
      <Card className="p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </Card>
    );
  }

  if (!hasAnyData) return null;

  const cheerfulRatio = wellness?.cheerfulRatio ?? 0;

  return (
    <Card className="p-5 space-y-5 border-l-4 border-l-violet-400">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-400" />
        <h3 className="font-semibold text-sm text-foreground">Behavior & Learning Insights</h3>
        <span className="text-xs text-muted-foreground ml-auto">Last 7 days</span>
      </div>

      {/* Mood Arc */}
      {moods.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <MoodIcon ratio={cheerfulRatio} />
            <span>Mood Arc</span>
            <span className="ml-auto font-normal normal-case text-foreground">
              {wellness ? `${Math.round(cheerfulRatio * 100)}% green days` : ""}
            </span>
          </div>
          <div className="flex gap-1.5 items-end">
            {moodArc.map(({ date, zone }) => (
              <div key={date} className="flex flex-col items-center gap-1">
                <MoodDot zone={zone} />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus % */}
      {focusStats && focusStats.total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Block Completion (7 days)</span>
            <span className="ml-auto font-normal normal-case text-foreground">
              {focusStats.completed} / {focusStats.total} blocks
            </span>
          </div>
          <ScoreBar
            value={focusStats.focusPct ?? 0}
            color={focusStats.focusPct != null && focusStats.focusPct >= 70 ? "bg-emerald-400" : focusStats.focusPct != null && focusStats.focusPct >= 40 ? "bg-amber-400" : "bg-rose-400"}
          />
          <p className="text-[11px] text-muted-foreground">
            {focusStats.focusPct != null ? `${focusStats.focusPct}% focus rate` : "No data yet"}
            {focusStats.focusPct != null && focusStats.focusPct >= 80 ? " — excellent" : focusStats.focusPct != null && focusStats.focusPct >= 60 ? " — good" : focusStats.focusPct != null && focusStats.focusPct < 60 ? " — below target" : ""}
          </p>
        </div>
      )}

      {/* Wellness Scores */}
      {wellness && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Anxiety signal</span>
              <span className={wellness.anxietyScore > 60 ? "text-rose-400 font-medium" : wellness.anxietyScore > 30 ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                {wellness.anxietyScore > 60 ? "Elevated" : wellness.anxietyScore > 30 ? "Moderate" : "Low"}
              </span>
            </div>
            <ScoreBar value={wellness.anxietyScore} color={wellness.anxietyScore > 60 ? "bg-rose-400" : wellness.anxietyScore > 30 ? "bg-amber-400" : "bg-emerald-400"} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Mood stability</span>
              <span className={wellness.depressionScore > 60 ? "text-rose-400 font-medium" : wellness.depressionScore > 30 ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                {wellness.depressionScore > 60 ? "Needs support" : wellness.depressionScore > 30 ? "Variable" : "Stable"}
              </span>
            </div>
            <ScoreBar value={wellness.depressionScore} color={wellness.depressionScore > 60 ? "bg-rose-400" : wellness.depressionScore > 30 ? "bg-amber-400" : "bg-emerald-400"} />
          </div>
        </div>
      )}

      {/* Struggle Trends */}
      {struggleTrends.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Struggle Trends (30 days)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {struggleTrends.map(({ subject, count }) => (
              <span
                key={subject}
                className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                {subject} × {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Learning Style Profile */}
      {(learningProfile.strengths.length > 0 || learningProfile.accommodations.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Learning Profile</span>
          </div>
          <div className="space-y-2">
            {learningProfile.strengths.length > 0 && (
              <div>
                <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {learningProfile.strengths.map((k, i) => (
                    <li key={i} className="text-xs text-foreground/80 leading-snug">• {k.insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {learningProfile.accommodations.length > 0 && (
              <div>
                <p className="text-[10px] text-violet-400 font-medium uppercase tracking-wide mb-1">Accommodations</p>
                <ul className="space-y-0.5">
                  {learningProfile.accommodations.map((k, i) => (
                    <li key={i} className="text-xs text-foreground/80 leading-snug">• {k.insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {learningProfile.preferences.length > 0 && (
              <div>
                <p className="text-[10px] text-sky-400 font-medium uppercase tracking-wide mb-1">Preferences</p>
                <ul className="space-y-0.5">
                  {learningProfile.preferences.map((k, i) => (
                    <li key={i} className="text-xs text-foreground/80 leading-snug">• {k.insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {wellness && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Target className="w-3.5 h-3.5" />
            <span>This Week's Focus</span>
          </div>
          <ul className="space-y-1">
            {wellness.anxietyScore > 60 && (
              <li className="text-xs text-foreground/80">• High anxiety signal — consider shorter blocks and more movement breaks</li>
            )}
            {wellness.anxietyScore <= 30 && wellness.greens >= 3 && (
              <li className="text-xs text-foreground/80">• Strong green-zone week — good time to introduce new or challenging material</li>
            )}
            {struggleTrends[0] && (
              <li className="text-xs text-foreground/80">• Most struggles in <strong>{struggleTrends[0].subject}</strong> — review block recommended</li>
            )}
            {wellness.reds === 0 && wellness.yellows === 0 && moods.length > 0 && (
              <li className="text-xs text-foreground/80">• No red or yellow days logged — excellent regulation this week</li>
            )}
            {moods.length === 0 && (
              <li className="text-xs text-muted-foreground">• No mood logs yet — tap the mood check-in on the Today page to start tracking</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
