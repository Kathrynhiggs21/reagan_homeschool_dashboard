import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Finds the best-matching curriculumTopics row for an arbitrary label
 * (assignment title, skill name, schedule block title). If any of `code`,
 * `standardRef`, or `match` matches, it renders a tiny chip like "Math 7-4"
 * (with the full Ohio standard as a tooltip).
 */
export default function CurriculumChip({
  match,
  code,
  standardRef,
  className = "",
}: {
  match?: string;
  code?: string;
  standardRef?: string;
  className?: string;
}) {
  const list = trpc.curriculum.list.useQuery(undefined, { staleTime: 60_000 });

  const topic = useMemo(() => {
    const rows = (list.data as any[]) ?? [];
    if (!rows.length) return null;
    if (code) return rows.find((r: any) => r.code === code) ?? null;
    if (standardRef) return rows.find((r: any) => r.standardRef === standardRef) ?? null;
    if (!match) return null;
    const lc = match.toLowerCase();
    // try exact code substring first, then title substring
    return (
      rows.find((r: any) => lc.includes(String(r.code).toLowerCase())) ||
      rows.find((r: any) => String(r.title).length > 10 && lc.includes(String(r.title).slice(0, 20).toLowerCase())) ||
      null
    );
  }, [list.data, code, standardRef, match]);

  if (!topic) return null;
  const label = topic.code;
  const title = `${topic.title}${topic.standardRef ? ` · ${topic.standardRef}` : ""}`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 ${className}`}
    >
      {label}
    </span>
  );
}
