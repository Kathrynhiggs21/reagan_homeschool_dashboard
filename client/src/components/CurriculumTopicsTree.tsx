import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { usePracticePrefs } from "@/hooks/usePracticePrefs";
import TopicDrawer from "@/components/TopicDrawer";

// Inlined prefs-aware version of shared/practiceLinks.ts — kept in this file
// because the client tsconfig paths don't alias the shared/ dir yet.
const IH_IXL_SIGNIN = "https://www.ixl.com/signin/indianhill";
const KHAN_KIDS_HOME = "https://www.khanacademykids.org";
function derivePracticeLinks(opts: {
  subject: string;
  title: string;
  standardRef?: string | null;
  khanUrl?: string | null;
  ixlUrl?: string | null;
  scaffolded?: boolean;
  prefs?: { ihIxl?: boolean; khanKids?: boolean };
}) {
  const prefs = opts.prefs ?? {};
  const baseQ = (opts.standardRef ? opts.standardRef + " " : "") + opts.title;
  const q = encodeURIComponent(baseQ.trim());
  const useKhanKids = Boolean(opts.scaffolded && prefs.khanKids);
  const khanSearchRoot = useKhanKids
    ? `${KHAN_KIDS_HOME}/?search=`
    : `https://www.khanacademy.org/search?page_search_query=`;
  const khan = opts.khanUrl && !useKhanKids ? opts.khanUrl : `${khanSearchRoot}${q}`;
  const rawIxl = opts.ixlUrl || `https://www.ixl.com/search?q=${q}`;
  const ixl = prefs.ihIxl
    ? `${IH_IXL_SIGNIN}?returnUrl=${encodeURIComponent(rawIxl)}`
    : rawIxl;
  return { khan, ixl, usedIhSso: Boolean(prefs.ihIxl), usedKhanKids: useKhanKids };
}

type Topic = {
  id: number;
  subject: string;
  code: string;
  title: string;
  standardRef: string | null;
  parentId: number | null;
  ord: number;
  status: "notStarted" | "inProgress" | "done";
  completedAt?: string | Date | null;
  quarter: string | null;
  notes: string | null;
  khanUrl?: string | null;
  ixlUrl?: string | null;
};

function PracticeLinks({ t, small = false }: { t: Topic; small?: boolean }) {
  const { prefs } = usePracticePrefs();
  // A topic is "scaffolded" when it's flagged Q1 and still marked notStarted,
  // or when the tutor has added notes asking for extra support. Falls back to
  // "not scaffolded" in the common case.
  const scaffolded = Boolean(t.notes && /scaffold|kids|below-grade/i.test(t.notes));
  const links = derivePracticeLinks({
    subject: t.subject,
    title: t.title,
    standardRef: t.standardRef,
    khanUrl: t.khanUrl,
    ixlUrl: t.ixlUrl,
    scaffolded,
    prefs,
  });
  const cls = small
    ? "text-[9px] px-1 py-0 h-4 rounded border bg-transparent"
    : "text-[10px] px-1.5 py-0 h-5 rounded border bg-transparent";
  const khanLabel = links.usedKhanKids ? "Khan Kids" : "Khan";
  const ixlLabel = links.usedIhSso ? "IXL (IH)" : "IXL";
  // 2026-05-12 push 13 — swap from text-emerald-700/rose-700 (illegible on dark
  // theme) to dual-tone classes via dark: variants so the chips read on both
  // Cream Homeschool (light) AND Starry Chalkboard / Chalkboard Night (dark).
  return (
    <span className="inline-flex gap-1 ml-1">
      <a href={links.khan} target="_blank" rel="noopener noreferrer" className={cls + " border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30"} title={links.usedKhanKids ? "Open on Khan Academy Kids" : "Open on Khan Academy"}>{khanLabel}</a>
      <a href={links.ixl} target="_blank" rel="noopener noreferrer" className={cls + " border-rose-400 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"} title={links.usedIhSso ? "Open IXL via Indian Hill SSO" : "Open on IXL"}>{ixlLabel}</a>
    </span>
  );
}

const SUBJECTS = ["Math", "ELA", "Science", "Social", "Specials"] as const;
type Subject = (typeof SUBJECTS)[number];

/** Map curriculum subject names ("math" / "ELA" / "Science" / "Social Studies") to subject slug. */
function subjectSlugFromName(subject: string): string {
  const s = (subject || "").toLowerCase();
  if (s.includes("math")) return "math";
  if (s.includes("ela") || s.includes("english") || s.includes("language")) return "ela";
  if (s.includes("read")) return "reading";
  if (s.includes("social") || s.includes("history") || s.includes("geo")) return "ss";
  if (s.includes("sci")) return "science";
  if (s.includes("art")) return "art";
  if (s.includes("phys") || s.includes("pe")) return "pe";
  return s || "math";
}

/** Inline pop-out for free, no-login external resources for a topic. */
function MoreLinksButton(props: { subjectSlug: string; topicName: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = trpc.curriculum.freeLinks.useQuery(
    { subjectSlug: props.subjectSlug, topicName: props.topicName, gradeBand: "5" },
    { enabled: open },
  );
  const sz = props.small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className={`rounded-full border ${sz} border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        title="Find more for this topic (Khan / IXL / printable / outdoor)"
      >
        ✨ More
      </button>
      {open && (
        <div className="absolute z-30 mt-1 right-0 min-w-[280px] max-w-[340px] rounded-md border bg-popover text-popover-foreground shadow-lg p-2 space-y-1">
          <div className="text-[10px] font-semibold opacity-70 px-1">Free, no-login resources</div>
          {q.isLoading && <div className="text-[11px] opacity-70 px-1">Loading…</div>}
          {!q.isLoading && (q.data as any[] | undefined)?.length === 0 && (
            <div className="text-[11px] opacity-70 px-1">No suggestions yet.</div>
          )}
          {((q.data as any[]) ?? []).map((l: any) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-accent"
            >
              <span aria-hidden>{l.emoji}</span>
              <span className="flex-1 truncate">{l.label}</span>
              <span className="text-[9px] opacity-60">{l.source}</span>
            </a>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[10px] opacity-60 hover:opacity-100 px-1 mt-1"
          >
            close
          </button>
        </div>
      )}
    </span>
  );
}

const subjectEmoji: Record<Subject, string> = {
  Math: "➗",
  ELA: "📖",
  Science: "🔬",
  Social: "🌎",
  Specials: "🎨",
};

export default function CurriculumTopicsTree() {
  const [tab, setTab] = useState<Subject>("Math");
  const list = trpc.curriculum.list.useQuery();
  const progress = trpc.curriculum.progress.useQuery();
  const seed = trpc.curriculum.ensureSeeded.useMutation();
  const autoComp = trpc.curriculum.autoCompleteFromHistory.useMutation();
  const toggle = trpc.curriculum.toggle.useMutation();
  const utils = trpc.useUtils();
  const [drawerTopic, setDrawerTopic] = useState<Topic | null>(null);

  const rows = (list.data as any[]) ?? [];
  const byId = useMemo(() => {
    const m = new Map<number, Topic>();
    for (const r of rows) m.set(r.id, r as Topic);
    return m;
  }, [rows]);

  const forSubject = useMemo(
    () => rows.filter((r: Topic) => r.subject === tab),
    [rows, tab],
  );

  const topLevel = forSubject.filter((r: Topic) => !r.parentId);
  const childrenOf = (pid: number) =>
    forSubject.filter((r: Topic) => r.parentId === pid).sort((a, b) => a.ord - b.ord);

  async function flipStatus(row: Topic) {
    const next = row.status === "done" ? "notStarted" : "done";
    await toggle.mutateAsync({ id: row.id, status: next });
    utils.curriculum.list.invalidate();
    utils.curriculum.progress.invalidate();
  }

  async function handleSeed() {
    const r: any = await seed.mutateAsync();
    toast.success(r.seeded ? `Seeded ${r.count} topics` : `Already seeded (${r.count})`);
    utils.curriculum.list.invalidate();
    utils.curriculum.progress.invalidate();
  }

  async function handleAuto() {
    const r: any = await autoComp.mutateAsync();
    toast.success(`Auto-checked ${r.checked} topics (${r.byQuarter} by Q1)`);
    utils.curriculum.list.invalidate();
    utils.curriculum.progress.invalidate();
  }

  return (
    <Card className="cozy-card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-display font-semibold text-lg">Topics & Standards</h2>
          <p className="text-xs text-muted-foreground">
            Ohio 5th-grade scope. Tick to mark complete.
          </p>
        </div>
        <div className="flex gap-2">
          {rows.length === 0 && (
            <Button size="sm" onClick={handleSeed} disabled={seed.isPending}>
              {seed.isPending ? "Seeding…" : "Seed curriculum"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="bg-transparent" onClick={handleAuto} disabled={autoComp.isPending}>
            {autoComp.isPending ? "Scanning…" : "Auto-check from history"}
          </Button>
        </div>
      </div>

      {/* progress strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {SUBJECTS.map((s) => {
          const p = (progress.data as any[])?.find((x) => x.subject === s);
          const pct = p?.pct ?? 0;
          const done = p?.done ?? 0;
          const total = p?.total ?? 0;
          const active = tab === s;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`text-left rounded-md px-2 py-1.5 border transition ${
                active ? "bg-primary/10 border-primary" : "bg-background/40 border-border hover:bg-primary/5"
              }`}
            >
              <div className="text-xs font-semibold flex items-center gap-1">
                <span>{subjectEmoji[s]}</span>
                <span>{s}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {done}/{total} · {pct}%
              </div>
              <Progress value={pct} className="h-1 mt-1" />
            </button>
          );
        })}
      </div>

      {/* topic tree */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No topics seeded yet. Click <em>Seed curriculum</em> above.
        </p>
      ) : (
        <div className="space-y-3">
          {topLevel
            .sort((a, b) => a.ord - b.ord)
            .map((t: Topic) => {
              const kids = childrenOf(t.id);
              const allDone = kids.length > 0 && kids.every((k) => k.status === "done");
              return (
                <div key={t.id} className="rounded-md border border-border/60 bg-card/40 dark:bg-card/30 p-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={t.status === "done" || allDone}
                      onCheckedChange={() => flipStatus(t)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                          {t.code}
                        </span>
                        {t.standardRef && (
                          <span
                            className="text-[10px] font-mono opacity-60"
                            title={`Ohio Learning Standard: ${t.standardRef}`}
                          >
                            {t.standardRef}
                          </span>
                        )}
                        {t.quarter && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-transparent">
                            {t.quarter}
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => setDrawerTopic(t)}
                          className={`text-sm text-left hover:underline ${
                            (t.status === "done" && t.completedAt) ? "line-through text-muted-foreground" : "font-medium"
                          }`}
                          title="Open topic resources & plan an assignment"
                        >
                          {t.title}
                        </button>
                        <PracticeLinks t={t} />
                        <MoreLinksButton subjectSlug={subjectSlugFromName(t.subject)} topicName={t.title} />
                      </div>
                      {kids.length > 0 && (
                        <ul className="mt-1 ml-2 space-y-0.5">
                          {kids.map((k) => (
                            <li key={k.id} className="flex items-start gap-2 text-xs">
                              <Checkbox
                                checked={k.status === "done"}
                                onCheckedChange={() => flipStatus(k)}
                                className="mt-0.5 size-3.5"
                              />
                              <span className="font-mono text-[9px] px-1 rounded bg-muted text-muted-foreground">
                                {k.code}
                              </span>
                              {k.standardRef && (
                                <span className="font-mono text-[9px] opacity-50" title={k.standardRef}>
                                  {k.standardRef}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setDrawerTopic(k)}
                                className={`text-left hover:underline ${
                                  (k.status === "done" && k.completedAt) ? "line-through text-muted-foreground" : ""
                                }`}
                              >
                                {k.title}
                              </button>
                              <PracticeLinks t={k} small />
                              <MoreLinksButton subjectSlug={subjectSlugFromName(k.subject)} topicName={k.title} small />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
      {drawerTopic && (
        <TopicDrawer
          topicId={drawerTopic.id}
          topicTitle={drawerTopic.title}
          topicCode={drawerTopic.code}
          open={!!drawerTopic}
          onClose={() => setDrawerTopic(null)}
        />
      )}
    </Card>
  );
}
