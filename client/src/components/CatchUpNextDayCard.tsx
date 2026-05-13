import { trpc } from "@/lib/trpc";

/**
 * Push 73 (2026-05-13) — "From yesterday" calm card for Today.
 *
 * Reads trpc.curriculum.nextDayQueue and renders 0–10 short nudges.
 * Self-hides whenever the list is empty (no-info rule, matches the
 * other Today strips like SummerModeBadge + KidHeaderStrips).
 */
export default function CatchUpNextDayCard() {
  const q = trpc.curriculum.nextDayQueue.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (q.isLoading) return null;
  const data = q.data;
  if (!data || !data.items || data.items.length === 0) return null;

  const subjectLabel = (slug: string) => {
    const map: Record<string, string> = {
      math: "Math",
      ela: "ELA",
      science: "Science",
      social: "Social",
      specials: "Specials",
      other: "Other",
    };
    return map[slug] ?? slug;
  };

  return (
    <section
      data-testid="catchup-nextday-card"
      className="rounded-xl border border-amber-300/30 bg-amber-50/5 px-4 py-3"
    >
      <header className="flex items-center justify-between mb-2">
        <h2 className="font-display text-base flex items-center gap-2">
          <span aria-hidden>↩️</span>
          From yesterday
        </h2>
        <span className="text-xs text-muted-foreground">
          {data.items.length} pick-up{data.items.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="space-y-1.5">
        {data.items.map((item) => (
          <li
            key={item.key}
            className="flex items-baseline gap-2 text-sm"
            data-subject={item.subjectSlug}
          >
            <span className="text-xs uppercase tracking-wide text-amber-300/80 w-16 shrink-0">
              {subjectLabel(item.subjectSlug)}
            </span>
            <span className="leading-snug">{item.topic}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
