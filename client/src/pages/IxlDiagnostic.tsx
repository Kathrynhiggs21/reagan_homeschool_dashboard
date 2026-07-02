import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdultLock } from "@/contexts/AdultLockContext";
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  Lock,
  ShieldCheck,
  Trash2,
} from "lucide-react";

/**
 * /ixl — IXL Diagnostic (adult, first-class destination).
 *
 * This is Katy's top-priority feature, pulled out of the buried /placement
 * sub-view into its own page + sidebar entry and restyled to the light-glass
 * theme. It:
 *   - shows a grade-level read per subject (Math / Language Arts) with strand
 *     breakdown + a plain "next step" line,
 *   - lets an adult record IXL Diagnostic levels (level number OR grade eq),
 *   - deep-links into IXL's Real-Time Diagnostic, already signed in when the
 *     IXL_QUICKSTART_URL secret is configured (badge tells you which).
 *
 * IXL has no public API, so levels are entered/pasted by an adult. Reagan
 * never sees this page (it lives behind the adult lock).
 */

const SUBJECT_LABEL: Record<string, { name: string; emoji: string }> = {
  math: { name: "Math", emoji: "🔢" },
  ela: { name: "Language Arts", emoji: "📖" },
};

export default function IxlDiagnostic() {
  const { user } = useAuth();
  const { unlocked } = useAdultLock();
  const isAdult = !!user;

  const utils = trpc.useUtils();
  const opts = trpc.ixl.strandOptions.useQuery(undefined, { refetchOnWindowFocus: false, enabled: isAdult });
  const report = trpc.ixl.report.useQuery(undefined, { refetchOnWindowFocus: false, enabled: isAdult });
  const list = trpc.ixl.list.useQuery(undefined, { refetchOnWindowFocus: false, enabled: isAdult });
  const link = trpc.ixl.diagnosticLink.useQuery(undefined, { refetchOnWindowFocus: false });

  const record = trpc.ixl.record.useMutation({
    onSuccess: () => {
      utils.ixl.report.invalidate();
      utils.ixl.list.invalidate();
    },
  });
  const remove = trpc.ixl.remove.useMutation({
    onSuccess: () => {
      utils.ixl.report.invalidate();
      utils.ixl.list.invalidate();
    },
  });

  const [subjectSlug, setSubjectSlug] = useState<"math" | "ela">("math");
  const [strandKey, setStrandKey] = useState<string>("overall");
  const [score, setScore] = useState<string>("");
  const [gradeEq, setGradeEq] = useState<string>("");

  const subjects = (opts.data as any)?.subjects ?? [];
  const currentSubject = subjects.find((s: any) => s.subjectSlug === subjectSlug);
  const strands: { key: string; label: string }[] = currentSubject?.strands ?? [];
  const strandLabel =
    strands.find((s) => s.key === strandKey)?.label ??
    (strandKey === "overall" ? "Overall" : strandKey);

  const reportData = report.data as any;
  const rows = (list.data as any[]) ?? [];
  const linkData = link.data as any;

  const canSave =
    (score.trim() !== "" && !Number.isNaN(Number(score))) || gradeEq.trim() !== "";

  const handleSave = () => {
    if (!canSave || record.isPending) return;
    record.mutate(
      {
        subjectSlug,
        strandKey,
        strandLabel,
        ixlScore: score.trim() === "" ? null : Math.round(Number(score)),
        gradeEquivalent: gradeEq.trim() === "" ? null : gradeEq.trim(),
      },
      {
        onSuccess: () => {
          setScore("");
          setGradeEq("");
        },
      },
    );
  };

  // Adult gate — this page is only meaningful for an unlocked adult.
  if (!isAdult || !unlocked) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card className="glass-panel p-6 space-y-3 text-center">
          <div className="flex justify-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/5">
              <Lock className="w-6 h-6" />
            </span>
          </div>
          <h1 className="font-display text-xl">IXL Diagnostic — adults only</h1>
          <p className="text-sm opacity-80">
            Reagan's diagnostic levels live behind the adult lock. Unlock the
            adult area to view and record them.
          </p>
          <div className="flex justify-center">
            <Link href="/settings">
              <Button className="glass-control--primary">Unlock adult area</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[rgba(34,193,164,0.16)]">
            <Activity className="w-5 h-5" style={{ color: "rgb(20,150,128)" }} />
          </span>
          <div>
            <h1 className="font-display text-2xl leading-tight">IXL Diagnostic</h1>
            <p className="text-xs opacity-70">Parent view — Reagan doesn't see this</p>
          </div>
        </div>
        <Link href="/today" className="text-sm underline opacity-70 hover:opacity-100 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Today
        </Link>
      </div>

      <p className="text-sm opacity-85">
        IXL's Real-Time Diagnostic pinpoints Reagan's levels in Math and Language
        Arts. Record what it reports here and the dashboard turns it into a
        grade-level read and feeds it to Kiwi and the agenda. IXL uses a 0–1000+
        level number; a grade equivalent (e.g. 4.5) works too.
      </p>

      {/* Deep link + how-to */}
      <Card className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-display text-sm">Run the Diagnostic</div>
          {linkData?.signedIn ? (
            <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-[rgba(34,193,164,0.16)] text-[rgb(20,120,104)]">
              <ShieldCheck className="w-3.5 h-3.5" /> Opens already signed in
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-black/5 opacity-75">
              One-time sign-in, then saved
            </span>
          )}
        </div>
        <ol className="text-xs opacity-80 space-y-1 list-decimal list-inside">
          <li>Open the Diagnostic (Reagan's IXL password is saved for autofill).</li>
          <li>Choose <span className="font-semibold">Diagnostic</span>, then <span className="font-semibold">Step into the Arena</span>.</li>
          <li>She answers at her own pace — no timer, it just adapts.</li>
          <li>Her levels (overall + by strand) appear; type them in below.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {linkData?.diagnosticUrl && (
            <a href={linkData.diagnosticUrl} target="_blank" rel="noopener noreferrer">
              <Button className="glass-control--primary inline-flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Open IXL Diagnostic
              </Button>
            </a>
          )}
          {linkData?.infoUrl && (
            <a href={linkData.infoUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-70">
              What is the Diagnostic?
            </a>
          )}
        </div>
      </Card>

      {/* Entry form */}
      <Card className="glass-panel p-4 space-y-3">
        <div className="font-display text-sm">Record a level</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs opacity-75 space-y-1">
            <span>Subject</span>
            <select
              value={subjectSlug}
              onChange={(e) => {
                setSubjectSlug(e.target.value as "math" | "ela");
                setStrandKey("overall");
              }}
              className="w-full rounded-md bg-white/70 border border-black/10 p-2 text-sm text-neutral-900"
            >
              <option value="math">Math</option>
              <option value="ela">Language Arts</option>
            </select>
          </label>
          <label className="text-xs opacity-75 space-y-1">
            <span>Strand</span>
            <select
              value={strandKey}
              onChange={(e) => setStrandKey(e.target.value)}
              className="w-full rounded-md bg-white/70 border border-black/10 p-2 text-sm text-neutral-900"
            >
              {strands.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs opacity-75 space-y-1">
            <span>IXL level number (0–1000+)</span>
            <input
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 480"
              className="w-full rounded-md bg-white/70 border border-black/10 p-2 text-sm text-neutral-900"
            />
          </label>
          <label className="text-xs opacity-75 space-y-1">
            <span>or Grade equivalent</span>
            <input
              value={gradeEq}
              onChange={(e) => setGradeEq(e.target.value)}
              placeholder="e.g. 4.5"
              className="w-full rounded-md bg-white/70 border border-black/10 p-2 text-sm text-neutral-900"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!canSave || record.isPending}
            className="glass-control--primary"
          >
            {record.isPending ? "Saving…" : `Save ${strandLabel}`}
          </Button>
          {record.isSuccess && !record.isPending && (
            <span className="text-xs" style={{ color: "rgb(21,128,61)" }}>Saved.</span>
          )}
          {record.isError && (
            <span className="text-xs" style={{ color: "rgb(190,40,60)" }}>Couldn't save — check the values.</span>
          )}
        </div>
      </Card>

      {/* Report */}
      {report.isLoading && (
        <div className="animate-pulse text-sm opacity-70">Loading…</div>
      )}

      {!report.isLoading && reportData && reportData.recordedCount === 0 && (
        <Card className="glass-panel p-5">
          <div className="text-sm opacity-85">
            No IXL levels recorded yet. Add Reagan's overall Math and Language
            Arts levels above — strands are optional but give a sharper read.
          </div>
        </Card>
      )}

      {!report.isLoading && reportData && (reportData.subjects ?? []).map((s: any) => {
        const label = SUBJECT_LABEL[s.subjectSlug] ?? { name: s.subjectName, emoji: "✏️" };
        const hasAny =
          s.overallGrade != null ||
          (Array.isArray(s.strands) && s.strands.some((st: any) => st.grade != null));
        if (!hasAny) return null;
        return (
          <Card key={s.subjectSlug} className="glass-panel p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>{label.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg">{s.subjectName}</div>
                <div className="text-sm font-medium" style={{ color: "rgb(20,150,128)" }}>{s.overallLabel}</div>
              </div>
            </div>
            <p className="text-sm opacity-85">{s.summary}</p>
            {Array.isArray(s.strands) && s.strands.filter((st: any) => st.grade != null).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider opacity-55">By strand</div>
                {s.strands.filter((st: any) => st.grade != null).map((st: any) => (
                  <div key={st.strandKey} className="flex items-center justify-between text-sm">
                    <span className="opacity-85">{st.strandLabel}</span>
                    <span className="opacity-65">{st.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-md p-2 text-sm bg-[rgba(34,193,164,0.12)] border border-[rgba(34,193,164,0.28)]">
              <span className="font-semibold" style={{ color: "rgb(18,120,104)" }}>Next step: </span>
              {s.nextStep}
            </div>
          </Card>
        );
      })}

      {/* Recorded rows */}
      {rows.length > 0 && (
        <Card className="glass-panel p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider opacity-55">Recorded entries</div>
          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-black/10 py-1 last:border-0">
              <span className="opacity-85">
                {(SUBJECT_LABEL[r.subjectSlug]?.name ?? r.subjectSlug)} · {r.strandLabel}
              </span>
              <span className="flex items-center gap-3">
                <span className="opacity-65">
                  {r.ixlScore != null ? `Level ${r.ixlScore}` : ""}
                  {r.ixlScore != null && r.gradeEquivalent ? " · " : ""}
                  {r.gradeEquivalent ? `Grade ${r.gradeEquivalent}` : ""}
                </span>
                <button
                  onClick={() => remove.mutate({ id: r.id })}
                  disabled={remove.isPending}
                  className="text-xs underline inline-flex items-center gap-1"
                  style={{ color: "rgb(190,40,60)" }}
                >
                  <Trash2 className="w-3 h-3" /> remove
                </button>
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
