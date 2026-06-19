/**
 * PrintIdeaBook — 2026-06-19
 *
 * Print-friendly Idea Book. Mom opens this to get a paper copy of the Idea
 * Library, grouped by type, with a checkbox per idea so she can tick off the
 * ones to try. Reads the same `adventures.listFiltered` data the screen uses
 * and honors `?kind=...&favorites=1` query params so a filtered on-screen
 * view can print exactly what's shown.
 *
 * Adult context: the /adventures page is adult-gated; this print route is a
 * read-only render of public library data.
 */
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type Kind =
  | "module"
  | "day_trip"
  | "reward"
  | "craft"
  | "brain_break"
  | "infrastructure"
  | "general";

const KIND_META: Record<Kind, { label: string; emoji: string }> = {
  module: { label: "Modules", emoji: "📦" },
  day_trip: { label: "Day Trips", emoji: "🚗" },
  reward: { label: "Rewards", emoji: "🎁" },
  craft: { label: "Crafts", emoji: "🎨" },
  brain_break: { label: "Brain Breaks", emoji: "🤸" },
  infrastructure: { label: "Workspace", emoji: "🧰" },
  general: { label: "General", emoji: "✨" },
};
const KIND_ORDER: Kind[] = [
  "module",
  "day_trip",
  "reward",
  "craft",
  "brain_break",
  "infrastructure",
  "general",
];

function readQuery(): { kind?: Kind; favorites?: boolean; auto: boolean } {
  if (typeof window === "undefined") return { auto: true };
  const sp = new URLSearchParams(window.location.search);
  const kindRaw = sp.get("kind") as Kind | null;
  const kind = kindRaw && KIND_ORDER.includes(kindRaw) ? kindRaw : undefined;
  const favorites = sp.get("favorites") === "1";
  const auto = sp.get("auto") !== "0";
  return { kind, favorites, auto };
}

export default function PrintIdeaBook() {
  const [, setLocation] = useLocation();
  const params = useMemo(readQuery, []);

  const q = trpc.adventures.listFiltered.useQuery(
    {
      kind: params.kind,
      favoritesOnly: params.favorites ? true : undefined,
    },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (q.data && params.auto !== false) {
      const t = setTimeout(() => {
        try {
          window.print();
        } catch {
          /* best-effort */
        }
      }, 250);
      return () => clearTimeout(t);
    }
  }, [q.data, params.auto]);

  if (q.isLoading) {
    return <main className="p-8 text-sm text-muted-foreground">Loading Idea Book…</main>;
  }
  if (q.error) {
    return (
      <main className="p-8 text-sm">
        <h1 className="font-bold mb-2">Couldn't load the Idea Book.</h1>
        <button className="mt-4 underline text-sm" onClick={() => setLocation("/adventures")}>
          ← Back to Idea Library
        </button>
      </main>
    );
  }

  const list = (q.data ?? []) as any[];
  const grouped = KIND_ORDER.map((k) => ({
    kind: k,
    items: list.filter((a) => (a.kind ?? "general") === k),
  })).filter((g) => g.items.length > 0);

  const title = params.favorites
    ? "Reagan's Idea Book — Favorites"
    : params.kind
      ? `Reagan's Idea Book — ${KIND_META[params.kind].label}`
      : "Reagan's Idea Book";

  return (
    <main
      className="bg-white text-black mx-auto"
      style={{
        maxWidth: "210mm",
        padding: "12mm 14mm",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
      data-testid="print-idea-book"
    >
      <style>{`
        @media print {
          @page { size: Letter; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .ib-item { break-inside: avoid; page-break-inside: avoid; }
          .ib-section { break-inside: avoid-page; }
        }
        .ib-item { display: grid; grid-template-columns: 18px 1fr; gap: 10px; padding: 7px 0; border-bottom: 1px dotted #ccc; }
        .ib-box { width: 14px; height: 14px; border: 1.5px solid #444; border-radius: 3px; margin-top: 2px; }
        .ib-meta { color: #555; font-size: 11px; margin-top: 2px; }
      `}</style>

      <header className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="text-xs text-gray-500">{list.length} ideas</div>
      </header>
      <p className="text-xs text-gray-500 mb-4">
        Tick the box next to any idea you want to try, then add it to a day from the Idea
        Library screen.
      </p>

      <div className="no-print mb-4 flex gap-3 text-sm">
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
        >
          Print
        </button>
        <button
          onClick={() => setLocation("/adventures")}
          className="px-3 py-1.5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
        >
          Back
        </button>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-gray-600">No ideas match this view.</p>
      ) : (
        grouped.map((g) => (
          <section key={g.kind} className="ib-section mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 border-b-2 border-gray-300 pb-1 mb-1">
              {KIND_META[g.kind].emoji} {KIND_META[g.kind].label}{" "}
              <span className="font-normal text-gray-400">({g.items.length})</span>
            </h2>
            {g.items.map((a) => {
              const dur =
                a.minDurationMin != null
                  ? `${a.minDurationMin}${
                      a.maxDurationMin && a.maxDurationMin !== a.minDurationMin
                        ? `–${a.maxDurationMin}`
                        : ""
                    } min`
                  : null;
              const meta = [a.setting, a.energyLevel ? `${a.energyLevel} energy` : null, dur]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={a.id} className="ib-item">
                  <div className="ib-box" />
                  <div>
                    <div className="font-semibold text-[13px]">
                      {a.emoji ? `${a.emoji} ` : ""}
                      {a.title}
                      {a.isFavorite ? <span className="text-amber-500"> ★</span> : null}
                    </div>
                    {a.description && (
                      <div className="text-[12px] text-gray-700 leading-snug">{a.description}</div>
                    )}
                    {meta && <div className="ib-meta">{meta}</div>}
                  </div>
                </div>
              );
            })}
          </section>
        ))
      )}
    </main>
  );
}
