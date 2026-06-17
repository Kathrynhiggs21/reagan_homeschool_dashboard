import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Shuffle, Bird, Sparkles, Leaf } from "lucide-react";

/**
 * Brain-Break TV Box
 * -------------------
 * A small curated rotator of short, kid-safe, Reagan-aligned clips
 * (birds, animals, nature, cozy "smile-makers"). Uses local YouTube
 * embed IDs so there's no network/API dependency — and the clips
 * shuffle each time she opens the page, or taps Next.
 *
 * Rules for curation (any future edits must follow):
 *  - ≤ 4 min each
 *  - No ads opening the clip when possible (linked with YouTube's
 *    no-cookie domain + modestbranding=1)
 *  - No loud/startling/jumpscare content
 *  - Weighted to: birds, parakeets, animals, nature, nice people
 */

type Clip = {
  id: string;          // YouTube video ID
  title: string;
  emoji: string;
  tag: "Birds" | "Animals" | "Nature" | "Smile";
};

const CLIPS: Clip[] = [
  // Birds / parakeets (weighted heaviest — matches Kiwi)
  { id: "Pt5_GSKIWQM", title: "Budgies chattering", emoji: "🦜", tag: "Birds" },
  { id: "CQ85sUNBK7w", title: "Parakeets being silly", emoji: "🐦", tag: "Birds" },
  { id: "N98nlyH9P_8", title: "Backyard hummingbirds", emoji: "🐦", tag: "Birds" },
  { id: "R-3VHIXM_7M", title: "Owl chicks grow up", emoji: "🦉", tag: "Birds" },
  // Animals
  { id: "LV4Z6ZcI1WY", title: "Baby otters", emoji: "🦦", tag: "Animals" },
  { id: "pIqKb1sVLHQ", title: "Bearded dragon adventure", emoji: "🦎", tag: "Animals" },
  { id: "2U_3pAQ1sUQ", title: "Cat meets baby goats", emoji: "🐐", tag: "Animals" },
  // Nature
  { id: "2OEL4P1Rz04", title: "Forest sounds (2 min)", emoji: "🌲", tag: "Nature" },
  { id: "eKFTSSKCzWA", title: "Ocean waves close-up", emoji: "🌊", tag: "Nature" },
  { id: "1ZYbU82GVz4", title: "Time-lapse: flowers opening", emoji: "🌼", tag: "Nature" },
  // Smile
  { id: "tPEE9ZwTmy0", title: "Good news of the week", emoji: "🌞", tag: "Smile" },
];

function pickNext(current?: string): Clip {
  const pool = CLIPS.filter((c) => c.id !== current);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export default function BrainBreakTvBox() {
  const initial = useMemo(() => pickNext(), []);
  const [clip, setClip] = useState<Clip>(initial);
  const [playing, setPlaying] = useState(false);

  const tagIcon = (t: Clip["tag"]) => {
    switch (t) {
      case "Birds": return <Bird className="h-3.5 w-3.5" />;
      case "Animals": return <Sparkles className="h-3.5 w-3.5" />;
      case "Nature": return <Leaf className="h-3.5 w-3.5" />;
      default: return <Sparkles className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="h-4 w-4" />
          Brain-Break TV
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
            {tagIcon(clip.tag)} {clip.tag}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="aspect-video w-full overflow-hidden rounded-md border">
          {playing ? (
            <iframe
              key={clip.id}
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
              title={clip.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              // No grey/black box (Katy's rule): the unstarted state is always a
              // warm kiwi-teal gradient. The thumbnail fades in on top when it
              // loads; if it 404s the gradient stays — never a grey void.
              className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500 via-emerald-500 to-amber-400 text-white hover:opacity-95"
              aria-label={`Play ${clip.title}`}
            >
              <img
                src={`https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300"
                onLoad={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.75";
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="relative flex flex-col items-center gap-2 drop-shadow">
                <span className="text-4xl">{clip.emoji}</span>
                <span className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-black shadow">
                  ▶ Play — {clip.title}
                </span>
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="truncate text-muted-foreground">
            {clip.emoji} {clip.title}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setClip(pickNext(clip.id));
              setPlaying(false);
            }}
          >
            <Shuffle className="mr-1 h-3.5 w-3.5" />
            Next clip
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Short, cozy videos for a brain break. Keep it to one or two, then back to the adventure.
        </div>
      </CardContent>
    </Card>
  );
}
