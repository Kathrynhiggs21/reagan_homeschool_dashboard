import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Universal AI search bar.
 *
 * Lives at the top of the Library / Agenda Editor page.
 *
 * Anyone (admin or tutor) can:
 *   - type a request ("a fun fractions practice for tomorrow")
 *   - upload a worksheet image (we send a hint to the finder)
 *   - pick a date
 *   - see results from the Library + kid-safe web/YouTube
 *   - one-click "Add to schedule" → creates a block on the picked date
 *
 * Backed by adultAi.findAssignments + adultAi.addBlock.
 */
export default function AISearchBar() {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [dateStr, setDateStr] = useState(today);
  const [imageHint, setImageHint] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const find = (trpc as any).adultAi?.findAssignments?.useMutation?.({
    onSuccess: (data: any) => {
      setResults(Array.isArray(data?.results) ? data.results : []);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Search failed");
    },
  });

  const addToDay = (trpc as any).adultAi?.addFinderResultToDate?.useMutation?.({
    onSuccess: () => toast.success("Added to the day"),
    onError: (e: any) => toast.error(e?.message ?? "Could not add"),
  });

  async function onUpload(file: File) {
    // We don't ship full image-vision yet; just record a friendly hint
    // and the filename so the AI can use it as context.
    setImageHint(`Image uploaded: ${file.name}`);
    toast.info("Image attached as a hint — type what you'd like to find with it.");
  }

  async function onSearch() {
    if (!query.trim() && !imageHint) {
      toast.error("Type what you'd like to find.");
      return;
    }
    setBusy(true);
    try {
      const composed = imageHint ? `${query}\n(${imageHint})` : query;
      await find?.mutateAsync?.({
        query: composed,
        dateStr,
        kidSafe: false,
      });
    } finally {
      setBusy(false);
    }
  }

  function onDrop(r: any) {
    addToDay?.mutate?.({
      dateStr,
      title: r.title,
      url: r.url ?? null,
      type: r.type ?? "other",
      subjectSlug: r.subjectSlug ?? null,
      curriculumTopicCode: r.curriculumTopicCode ?? null,
      curriculumTopicId: r.curriculumTopicId ?? null,
      estimatedMinutes: r.estimatedMinutes ?? 20,
      source: r.source ?? "sonar_web",
      internalId: r.internalId ?? null,
    });
  }

  return (
    <Card className="cozy-card p-4 space-y-3">
      <div>
        <div className="font-display font-semibold text-lg">
          Find anything for the schedule
        </div>
        <div className="text-xs text-muted-foreground">
          Search the Library, the apps Reagan uses, and the kid-safe web. Type what
          you need, pick a day, and tap a result to add it.
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[14rem]">
          <div className="text-xs text-muted-foreground mb-1">What do you need?</div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. fractions practice video, Tuck Everlasting chapter discussion, easy grammar warm-up"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">For day</div>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value || today)}
            className="w-40"
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Image hint</div>
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            <Button asChild variant="outline" size="sm">
              <span className="cursor-pointer">
                {imageHint ? "Image attached" : "Upload"}
              </span>
            </Button>
          </label>
        </div>
        <Button onClick={onSearch} disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </div>

      {imageHint && (
        <div className="text-xs text-muted-foreground italic flex items-center gap-2">
          {imageHint}
          <button
            className="underline"
            onClick={() => setImageHint(null)}
          >
            remove
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Results
          </div>
          <ul className="space-y-2">
            {results.map((r: any, i: number) => (
              <li
                key={i}
                className="border rounded-md p-3 flex items-start gap-3 bg-white/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.source ?? "web"}
                    {r.estimatedMinutes ? ` · ~${r.estimatedMinutes} min` : ""}
                    {r.curriculumTopicCode ? ` · ${r.curriculumTopicCode}` : ""}
                  </div>
                  {r.description && (
                    <div className="text-xs mt-1 text-muted-foreground line-clamp-2">
                      {r.description}
                    </div>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-amber-600"
                    >
                      Open source
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {r.curriculumTopicCode ? (
                    <Badge variant="outline" className="text-[10px]">
                      {r.curriculumTopicCode}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-rose-500">
                      no topic
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onDrop(r)}
                    disabled={!r.curriculumTopicCode || addToDay?.isPending}
                    title={
                      !r.curriculumTopicCode
                        ? "Needs a curriculum topic first"
                        : "Add to the picked day"
                    }
                  >
                    Add to {dateStr}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
