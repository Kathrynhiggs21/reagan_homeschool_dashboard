import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tv, Shuffle, X } from "lucide-react";

/**
 * TVBox — a picture-in-picture "classroom TV" that plays adult-approved
 * YouTube videos. Reagan can browse by topic or hit "Surprise me" for a
 * random brain-break. No external nav — videos play in the overlay.
 */
export default function TVBox({
  defaultOpen = false,
  topic,
  label = "Classroom TV",
}: {
  defaultOpen?: boolean;
  topic?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");

  const q = trpc.review.list.useQuery({ approvedOnly: true });
  const all = Array.isArray(q.data) ? q.data : [];
  const ytAll = all.filter((r: any) => r.kind === "youtube" && r.youtubeId);
  const list = useMemo(() => {
    if (topic) return ytAll.filter((r: any) => r.topic === topic);
    return ytAll;
  }, [ytAll, topic]);

  const surpriseMe = () => {
    const brainBreaks = ytAll.filter((r: any) => r.subjectSlug === "brain-break");
    const pool = brainBreaks.length > 0 ? brainBreaks : ytAll;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setActiveId(pick.youtubeId);
    setActiveTitle(pick.title);
    setOpen(true);
  };

  return (
    <>
      <Card className="classroom-card p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }}
        >
          <Tv className="text-white w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-base">{label} 📺</div>
          <div className="text-xs text-muted-foreground">
            Adult-approved videos. Tap Surprise Me for a movement break.
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="rounded-full">
          Browse
        </Button>
        <Button size="sm" onClick={surpriseMe} className="rounded-full" disabled={list.length === 0}>
          <Shuffle className="w-4 h-4 mr-1" /> Surprise me
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setActiveId(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {activeId ? activeTitle : "Classroom TV 📺"}
            </DialogTitle>
          </DialogHeader>
          {activeId ? (
            <div className="space-y-3">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeId}?autoplay=1&rel=0&modestbranding=1`}
                  title={activeTitle}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setActiveId(null)}>
                  ← Back to picks
                </Button>
                <Button onClick={surpriseMe}>
                  <Shuffle className="w-4 h-4 mr-1" /> Another surprise
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
              {/* 2026-05-05 — standing rule: don't show if no info. The empty
                  TVBox simply renders nothing for the kid. */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {list.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => { setActiveId(r.youtubeId); setActiveTitle(r.title); }}
                    className="group text-left rounded-xl overflow-hidden border hover:shadow-md transition bg-background"
                  >
                    <div className="aspect-video w-full bg-muted relative">
                      <img
                        src={`https://i.ytimg.com/vi/${r.youtubeId}/hqdefault.jpg`}
                        alt={r.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                          <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-red-600 ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-semibold line-clamp-2">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.topic}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
