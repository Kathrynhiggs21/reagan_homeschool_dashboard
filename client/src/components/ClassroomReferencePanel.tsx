import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GraduationCap, ExternalLink } from "lucide-react";

/**
 * Adult-only reference panel: lists Reagan's Google Classroom assignments
 * synced from spear.cpt@gmail.com. Reference only — these never auto-populate
 * Reagan's daily plan. Collapsed by default to keep the adult dashboard quiet.
 */
export function ClassroomReferencePanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const q = trpc.gclassroom.list.useQuery({ limit: 25 }, { enabled: open });
  const items = (q.data ?? []) as Array<{
    id: number;
    courseName: string | null;
    title: string;
    workType: string | null;
    dueAt: Date | string | null;
    link: string | null;
  }>;

  return (
    <Card className="cozy-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="time-chip chip-sage !w-10 !h-10 !text-xl flex items-center justify-center">
            <GraduationCap size={20} />
          </span>
          <div>
            <div className="font-semibold leading-tight">
              Indian Hill Classroom <span className="text-xs opacity-70 font-normal">(reference only)</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Synced from spear.cpt@gmail.com · doesn’t change Reagan’s plan
            </div>
          </div>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {open && (
        <div className="mt-4">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!q.isLoading && items.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No Classroom items synced yet. The morning sync runs automatically once it’s scheduled.
            </div>
          )}
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it) => {
                const due =
                  it.dueAt == null
                    ? "no due date"
                    : new Date(it.dueAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      });
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[it.courseName, it.workType?.toLowerCase().replace(/_/g, " "), `due ${due}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {it.link && (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                        aria-label="Open in Google Classroom"
                      >
                        <Button size="sm" variant="outline">
                          <ExternalLink size={14} className="mr-1" /> Open
                        </Button>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
