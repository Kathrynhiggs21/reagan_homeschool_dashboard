import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math",
  ela: "ELA / Reading",
  science: "Science",
  ss: "Social Studies",
  social_studies: "Social Studies",
  writing: "Writing",
  history: "History",
  art: "Art",
  music: "Music",
};

const BAND_COLOR: Record<string, string> = {
  mastered: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  "on track": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "working on it": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "not yet": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
};

const BAND_EMOJI: Record<string, string> = {
  mastered: "🌟",
  "on track": "👍",
  "working on it": "⏳",
  "not yet": "🌱",
};

export default function ReportCardFifth() {
  const { user } = useAuth();
  const { data, isLoading, error } = trpc.skillLadder.reportCardFifth.useQuery(
    undefined,
    { enabled: user?.role === "admin" },
  );

  if (user && user.role !== "admin") {
    return (
      <div className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle>Parent-only page</CardTitle>
          </CardHeader>
          <CardContent>
            The 5th Grade Report Card is for Mom &amp; Dad. Sign in as a parent
            account to view it.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle>Report card unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error?.message ?? "Try again in a moment."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const subjectKeys = Object.keys(data.bySubject).sort();

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">5th Grade Report Card</h1>
        <p className="text-muted-foreground">
          Generated {new Date(data.generatedAt).toLocaleString()} ·
          based on the active 5th-grade skill ladder.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <Stat label="Mastered" value={data.totals.mastered} accent="text-green-600 dark:text-green-400" />
            <Stat label="On track" value={data.totals.onTrack} accent="text-blue-600 dark:text-blue-400" />
            <Stat label="Working on it" value={data.totals.workingOnIt} accent="text-amber-600 dark:text-amber-400" />
            <Stat label="Not yet" value={data.totals.notYet} accent="text-zinc-500" />
            <Stat label="Total skills" value={data.totals.overall} />
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{data.totals.pctMastered}%</span> of 5th-grade skills mastered.
          </div>
        </CardContent>
      </Card>

      {subjectKeys.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No 5th-grade ladder rows in the database yet.
          </CardContent>
        </Card>
      )}

      {subjectKeys.map((slug) => {
        const rows = data.bySubject[slug];
        return (
          <Card key={slug}>
            <CardHeader>
              <CardTitle>{SUBJECT_LABELS[slug] ?? slug}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.skillId}
                  className="flex items-center gap-3 py-2 border-b last:border-b-0"
                >
                  <span className="text-lg" aria-hidden>{BAND_EMOJI[r.band] ?? ""}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.skillCode} · {r.strand}
                    </div>
                  </div>
                  <Badge variant="outline" className={BAND_COLOR[r.band]}>
                    {r.band}
                  </Badge>
                  <div className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                    L{r.level}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
