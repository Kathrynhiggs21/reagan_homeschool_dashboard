/**
 * PrintForwardPlan — Push 2.12 (2026-05-17)
 *
 * Print-friendly route. Mom + Grandma open this when they want a paper copy
 * of the next ~2 weeks of curriculum-aware schedule. The page:
 *   - reads `?from=YYYY-MM-DD&days=10&title=...` from the URL,
 *   - calls curriculum.forwardPlan.printable (familyAdmin),
 *   - renders a clean, ink-conserving layout with a row per day and one cell
 *     per slot (subject + code + title + page-evidence),
 *   - includes a leading checkbox so Reagan / Mom can tick off items offline,
 *   - auto-pops the browser print dialog once data finishes loading.
 *
 * Adult-only by virtue of the underlying procedure being familyAdmin: a kid
 * session simply gets an empty render + no print.
 */
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

function readQuery(): {
  from?: string;
  days?: number;
  title?: string;
  auto?: boolean;
} {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const from = sp.get("from") ?? undefined;
  const daysRaw = sp.get("days");
  const days = daysRaw ? Math.max(1, Math.min(30, parseInt(daysRaw, 10))) : undefined;
  const title = sp.get("title") ?? undefined;
  const auto = sp.get("auto") !== "0"; // default true
  return { from, days, title, auto };
}

export default function PrintForwardPlan() {
  // Strip any DashboardLayout from the print: this route is mounted as a top-
  // level page in App.tsx OUTSIDE the kid layout shell.
  const [, setLocation] = useLocation();
  const params = useMemo(readQuery, []);
  const q = trpc.curriculum.forwardPlan.printable.useQuery(
    {
      startDate: params.from,
      horizonDays: params.days ?? 10,
      title: params.title,
    },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (q.data && params.auto !== false) {
      const t = setTimeout(() => {
        try {
          window.print();
        } catch {
          // best-effort
        }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [q.data, params.auto]);

  if (q.isLoading) {
    return (
      <main className="p-8 text-sm text-muted-foreground">
        Loading printable plan…
      </main>
    );
  }
  if (q.error) {
    return (
      <main className="p-8 text-sm">
        <h1 className="font-bold mb-2">Couldn’t load the printable plan.</h1>
        <p className="text-muted-foreground">
          You may need to unlock adult mode first.
        </p>
        <button
          className="mt-4 underline text-sm"
          onClick={() => setLocation("/today")}
        >
          ← Back to Today
        </button>
      </main>
    );
  }
  const data = q.data;
  if (!data) return null;

  return (
    <main
      className="bg-white text-black mx-auto"
      style={{
        maxWidth: "210mm",
        padding: "12mm 14mm",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
      data-testid="print-forward-plan"
    >
      <style>{`
        @media print {
          @page { size: Letter; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .pfp-day { break-inside: avoid; page-break-inside: avoid; }
        }
        .pfp-grid { display: grid; grid-template-columns: 14ch 1fr; gap: 6px 14px; }
        .pfp-day + .pfp-day { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #99a; }
      `}</style>

      <header className="flex items-baseline justify-between mb-3">
        <h1 className="text-xl font-bold">{data.title}</h1>
        <div className="text-xs text-gray-500">
          {data.totals.topics} topics · {data.totals.blockerTopics} carry-overs
        </div>
      </header>

      <div className="no-print mb-4 flex gap-3 text-sm">
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
        >
          Print
        </button>
        <button
          onClick={() => setLocation("/today")}
          className="px-3 py-1.5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
        >
          Back
        </button>
      </div>

      {data.days.length === 0 ? (
        <p className="text-sm text-gray-600">
          Nothing to print — Reagan’s curriculum gap is empty for this window.
        </p>
      ) : (
        data.days.map((d) => (
          <section
            key={d.date}
            className="pfp-day"
            data-testid={`pfp-day-${d.date}`}
          >
            <h2 className="text-base font-semibold mb-1">{d.label}</h2>
            <div className="pfp-grid text-[12.5px] leading-snug">
              <div className="font-semibold text-gray-600">Subject</div>
              <div className="font-semibold text-gray-600">Topic</div>
              {d.slots.map((s) => (
                <ScheduleRow key={`${s.date}-${s.slotIndex}`} slot={s} />
              ))}
            </div>
          </section>
        ))
      )}

      <footer className="text-[10px] text-gray-400 mt-6 pt-3 border-t border-gray-200">
        Reagan&apos;s Homeschool Dashboard · Forward Planner v2.12 · auto-built
        from the curriculum gap
      </footer>
    </main>
  );
}

function ScheduleRow({
  slot,
}: {
  slot: {
    subject: string;
    code: string;
    title: string;
    evidence: string | null;
    isBlockerFrontload: boolean;
  };
}) {
  return (
    <>
      <div className="font-medium">{slot.subject}</div>
      <div>
        <span className="inline-flex items-baseline gap-1.5">
          <span
            aria-hidden
            className="inline-block w-3 h-3 border border-gray-500 rounded-sm relative top-[1px]"
          />
          <span className="font-mono text-[11.5px] text-gray-500">
            {slot.code}
          </span>
          <span>{slot.title}</span>
          {slot.isBlockerFrontload && (
            <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">
              priority
            </span>
          )}
        </span>
        {slot.evidence && (
          <div className="text-[11px] text-gray-500 ml-5">{slot.evidence}</div>
        )}
      </div>
    </>
  );
}
