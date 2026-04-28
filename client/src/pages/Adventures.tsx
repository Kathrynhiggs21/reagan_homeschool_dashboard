import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useState } from "react";
import { useAdultLock } from "@/contexts/AdultLockContext";
import SubjectColorKey from "@/components/SubjectColorKey";
import { subjectTint, tintCardStyle, tintInkStyle, tintPillStyle } from "@/lib/subjectColors";
import { toast } from "sonner";

const CATS = ["all", "rescue", "outdoors", "art", "service", "wonder", "maker", "kitchen"];

function primarySubject(a: any): string {
  if (Array.isArray(a.subjectSlugs) && a.subjectSlugs.length > 0) return a.subjectSlugs[0];
  return "adventure";
}

function AdventureCard({ a }: { a: any }) {
  const fav = trpc.adventures.toggleFavorite.useMutation();
  const utils = trpc.useUtils();
  const subj = primarySubject(a);
  const tint = subjectTint(subj);
  const { unlocked } = useAdultLock();
  const [editingCover, setEditingCover] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");
  const genCover = (trpc as any).adventures?.generateCover?.useMutation?.({
    onSuccess: () => { toast.success("Cover refreshed."); utils.adventures.list.invalidate(); setEditingCover(false); setCustomPrompt(""); },
    onError: (e: any) => toast.error(e?.message || "Could not generate cover."),
  });
  const setUrl = (trpc as any).adventures?.updateCoverUrl?.useMutation?.({
    onSuccess: () => { toast.success("Cover saved."); utils.adventures.list.invalidate(); setEditingCover(false); setPastedUrl(""); },
    onError: (e: any) => toast.error(e?.message || "Could not save cover."),
  });
  return (
    <Card className="classroom-card overflow-hidden p-0" style={tintCardStyle(subj)}>
      {/* Hero image area */}
      <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ backgroundColor: tint.bg }}>
        {a.coverImageUrl ? (
          <img src={a.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl" aria-hidden="true">
            {a.emoji || tint.emoji}
          </div>
        )}
        <button
          aria-label={a.isFavorite ? "Unfavorite" : "Favorite"}
          onClick={() => fav.mutate({ id: a.id }, { onSuccess: () => utils.adventures.list.invalidate() })}
          className="absolute top-2 right-2 rounded-full p-1.5 bg-white/85 hover:bg-white shadow"
        >
          <Star className={`w-4 h-4 ${a.isFavorite ? "fill-amber-400 text-amber-400" : "text-neutral-500"}`} />
        </button>
        <span
          className="absolute bottom-2 left-2 text-[11px] font-semibold rounded-full px-2 py-0.5"
          style={tintPillStyle(subj)}
        >
          {tint.emoji} {tint.label}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-display font-semibold text-base leading-tight" style={tintInkStyle(subj)}>
          {a.title}
        </h3>
        {a.description && <p className="text-sm mt-1 opacity-80" style={tintInkStyle(subj)}>{a.description}</p>}
        <div className="text-[10px] uppercase tracking-wider mt-3 opacity-70" style={tintInkStyle(subj)}>
          {Array.isArray(a.interestTags) && a.interestTags.slice(0, 3).join(" · ")}
        </div>
        {unlocked && genCover && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/70 h-7 text-xs"
                disabled={genCover.isPending}
                onClick={() => genCover.mutate({ id: a.id })}
              >
                {genCover.isPending ? "✨ Drawing…" : a.coverImageUrl ? "↻ Re-roll cover" : "✨ Draw a cover"}
              </Button>
              <Button size="sm" variant="outline" className="bg-white/70 h-7 text-xs" onClick={() => setEditingCover(v => !v)}>
                ✎ Edit cover
              </Button>
            </div>
            {editingCover && (
              <div className="space-y-2 p-2 rounded bg-white/70 border">
                <input
                  type="text"
                  className="w-full h-7 px-2 rounded border text-xs"
                  placeholder="Custom prompt (e.g. cozy watercolor of a backyard fairy circle)"
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-6 text-[11px]"
                  disabled={!customPrompt.trim() || genCover.isPending}
                  onClick={() => genCover.mutate({ id: a.id, promptOverride: customPrompt.trim() })}
                >
                  Use custom prompt
                </Button>
                <input
                  type="url"
                  className="w-full h-7 px-2 rounded border text-xs"
                  placeholder="Or paste an image URL…"
                  value={pastedUrl}
                  onChange={e => setPastedUrl(e.target.value)}
                />
                {setUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] bg-white"
                    disabled={!pastedUrl.trim() || setUrl.isPending}
                    onClick={() => setUrl.mutate({ id: a.id, coverImageUrl: pastedUrl.trim() })}
                  >
                    Use this URL
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Adventures() {
  const [cat, setCat] = useState("all");
  const advs = trpc.adventures.list.useQuery();

  const list = ((advs.data ?? []) as any[]).filter((a) =>
    cat === "all" ||
    (Array.isArray(a.interestTags) && a.interestTags.includes(cat)) ||
    (Array.isArray(a.subjectSlugs) && a.subjectSlugs.includes(cat))
  );

  return (
    <div className="space-y-6">
      <header className="chalkboard">
        <h1 className="font-display text-4xl md:text-5xl leading-none">
          <span className="chalk-white">Adventure Library</span>
        </h1>
        <p className="font-display text-base chalk-white opacity-85 mt-2">Real-world things to do — animals, outdoors, art, and service.</p>
      </header>

      <SubjectColorKey variant="schedule" />

      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} className="rounded-full capitalize bg-card" onClick={() => setCat(c)}>{c}</Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((a: any) => (
          <AdventureCard key={a.id} a={a} />
        ))}
      </div>
      {list.length === 0 && (
        <Card className="classroom-card p-6 text-center text-sm text-muted-foreground">
          No adventures match that filter yet.
        </Card>
      )}
    </div>
  );
}
