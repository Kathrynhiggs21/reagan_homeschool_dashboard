/**
 * Printables — adult-only worksheet & printables hub.
 * 28+ pre-seeded free sources (Ohio, homeschool, 5th grade).
 * Type a topic → launches each supported source's search with {q} substituted.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import PrintButton from "@/components/PrintButton";

const SUBJECT_FILTERS = [
  { value: "all",     label: "All" },
  { value: "math",    label: "Math" },
  { value: "ela",     label: "ELA / Reading" },
  { value: "science", label: "Science" },
  { value: "ss",      label: "Social Studies" },
];

export default function Printables() {
  const sources = trpc.printables.listSources.useQuery();
  const favorites = trpc.printables.listFavorites.useQuery();
  const addFav = trpc.printables.addFavorite.useMutation();
  const removeFav = trpc.printables.removeFavorite.useMutation();
  const todayQ = trpc.plans.today.useQuery();
  const createBlock = trpc.blocks.create.useMutation();
  const utils = trpc.useUtils();

  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const all = (sources.data as any[] | undefined) ?? [];
    return all.filter((s) => {
      if (subjectFilter !== "all") {
        const subs = (s.subjects as string[] | null) ?? [];
        if (!subs.includes(subjectFilter)) return false;
      }
      if (tagFilter !== "all") {
        const tags = (s.tags as string[] | null) ?? [];
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });
  }, [sources.data, subjectFilter, tagFilter]);

  function launch(s: any) {
    if (q && s.searchUrl) {
      window.open(s.searchUrl.replace("{q}", encodeURIComponent(q)), "_blank", "noopener");
    } else {
      window.open(s.url, "_blank", "noopener");
    }
  }

  function launchAll() {
    if (!q) { toast.error("Type a topic first."); return; }
    let opened = 0;
    for (const s of filtered) {
      if (s.searchUrl) {
        window.open(s.searchUrl.replace("{q}", encodeURIComponent(q)), "_blank", "noopener");
        opened++;
      }
    }
    toast.success(`Opened ${opened} search tab${opened === 1 ? "" : "s"}.`);
  }

  async function addToToday(s: any) {
    const planId = (todayQ.data as any)?.plan?.id;
    if (!planId) { toast.error("Today's plan isn't ready yet."); return; }
    const url = s.searchUrl && q ? s.searchUrl.replace("{q}", encodeURIComponent(q)) : s.url;
    const title = q ? `${q} — ${s.name}` : s.name;
    await createBlock.mutateAsync({
      planId,
      blockType: "school",
      title,
      description: `Open: ${url}`,
      durationMin: 20,
    } as any);
    utils.plans.today.invalidate();
    toast.success(`Added “${title}” to Today.`);
  }

  async function saveFav(s: any) {
    const title = prompt(`Save a favorite for ${s.name}`, q || s.name);
    if (!title) return;
    const url = s.searchUrl && q ? s.searchUrl.replace("{q}", encodeURIComponent(q)) : s.url;
    await addFav.mutateAsync({ sourceId: s.id, title, url });
    utils.printables.listFavorites.invalidate();
    toast.success("Saved.");
  }

  // Collect tag chips from sources
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of (sources.data as any[] | undefined) ?? []) {
      for (const t of (s.tags as string[] | null) ?? []) set.add(t);
    }
    return Array.from(set.values()).sort();
  }, [sources.data]);

  return (
    <div className="space-y-6">
      <header className="chalkboard">
        <div className="font-chalk-hand text-xl chalk-yellow">Adult-only workspace</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Printables &amp; Worksheets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Free Ohio, homeschool, and 5th-grade-friendly worksheet sources. Type a topic and launch all searches at once.
        </p>
      </header>

      <Card className="classroom-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Type a topic, e.g. "fractions with unlike denominators"'
            className="flex-1"
          />
          <Button onClick={launchAll}>Search all filtered</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground self-center">Subject:</div>
          {SUBJECT_FILTERS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={subjectFilter === s.value ? "default" : "outline"}
              className="h-7 text-xs bg-transparent"
              onClick={() => setSubjectFilter(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground self-center">Tag:</div>
            <Button size="sm" variant={tagFilter === "all" ? "default" : "outline"} className="h-7 text-xs bg-transparent" onClick={() => setTagFilter("all")}>All</Button>
            {allTags.map((t) => (
              <Button key={t} size="sm" variant={tagFilter === t ? "default" : "outline"} className="h-7 text-xs bg-transparent" onClick={() => setTagFilter(t)}>
                {t}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <section>
        <h2 className="font-display text-xl font-semibold chalk-white mb-2">Sources ({filtered.length})</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s: any) => (
            <Card key={s.id} className="classroom-card p-4 flex flex-col">
              <div className="font-display font-semibold text-base">{s.name}</div>
              {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
              <div className="flex flex-wrap gap-1 mt-2">
                {(s.tags as string[] | null ?? []).slice(0, 4).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="outline" className="bg-transparent h-7 text-xs" onClick={() => launch(s)}>
                  {q && s.searchUrl ? "Search" : "Open"}
                </Button>
                {/* Print: open the printable URL in a new tab and auto-fire print dialog. */}
                <PrintButton
                  size="sm"
                  variant="outline"
                  label="Print"
                  className="h-7 text-xs bg-transparent"
                  url={q && s.searchUrl ? s.searchUrl.replace("{q}", encodeURIComponent(q)) : s.url}
                  title="Open this source and print it"
                />
                <Button size="sm" variant="outline" className="bg-transparent h-7 text-xs" onClick={() => addToToday(s)}>
                  + Today
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => saveFav(s)}>
                  ☆ Save
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {!!(favorites.data as any[] | undefined)?.length && (
        <section>
          <h2 className="font-display text-xl font-semibold chalk-white mb-2">Saved favorites</h2>
          <div className="space-y-2">
            {((favorites.data as any[]) ?? []).map((f) => (
              <Card key={f.id} className="classroom-card p-3 flex items-center justify-between">
                <div>
                  <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.title}</a>
                  {f.subjectSlug && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{f.subjectSlug}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <PrintButton size="sm" variant="outline" label="Print" className="h-7 text-xs bg-transparent" url={f.url} />
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={async () => {
                    await removeFav.mutateAsync({ id: f.id });
                    utils.printables.listFavorites.invalidate();
                  }}>
                    ×
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
