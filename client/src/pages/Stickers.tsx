import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

/**
 * Sticker Book — Reagan's collected stickers grid + coin balance.
 * Every completed block earns +1 sticker and +1 coin.
 */

// Inline SVG "stickers" — each slug renders a colorful doodle.
// Kept lightweight so we don't ship 20 PNGs.
function StickerArt({ slug, palette }: { slug: string; palette?: string | null }) {
  const p = palette || "butter";
  const colors: Record<string, { bg: string; ink: string }> = {
    coral:    { bg: "#ff8fa3", ink: "#5a0724" },
    peach:    { bg: "#ffb07a", ink: "#4a1a00" },
    butter:   { bg: "#ffe066", ink: "#4a3600" },
    mint:     { bg: "#7fe3c4", ink: "#063c2d" },
    sky:      { bg: "#7ec8ff", ink: "#062a5c" },
    lavender: { bg: "#c9a7ff", ink: "#2a0e66" },
    pink:     { bg: "#ffaad4", ink: "#500724" },
  };
  const c = colors[p] || colors.butter;
  const EMOJI: Record<string, string> = {
    "star-gold": "⭐", "rainbow-burst": "🌈", "parakeet-wink": "🦜", "heart-sparkle": "💖",
    "cupcake-pink": "🧁", "pencil-hero": "✏️", "lightbulb": "💡", "trophy-mini": "🏆",
    "book-magic": "📘", "apple-smile": "🍎", "crown-tiny": "👑", "balloon-bunch": "🎈",
    "butterfly": "🦋", "ladybug": "🐞", "taco": "🌮", "sun-happy": "☀️",
    "moon-wink": "🌙", "cloud-rainbow": "☁️", "cat-sticker": "🐱", "dog-sticker": "🐶",
  };
  const emoji = EMOJI[slug] || "⭐";
  return (
    <div
      className="relative w-full aspect-square rounded-2xl flex items-center justify-center"
      style={{
        background: c.bg,
        border: `3px solid white`,
        boxShadow: `0 4px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 2px ${c.ink}33`,
        color: c.ink,
      }}
    >
      <div className="text-4xl sm:text-5xl" style={{ filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.1))" }}>
        {emoji}
      </div>
      {/* tiny glimmer */}
      <div
        className="absolute w-4 h-4 rounded-full"
        style={{ top: 8, right: 10, background: "rgba(255,255,255,0.7)", filter: "blur(0.5px)" }}
      />
    </div>
  );
}

export default function Stickers() {
  const stks = trpc.rewards.myStickers.useQuery();
  const coins = trpc.rewards.myCoins.useQuery();
  const notes = trpc.rewards.goodWorkNotes.useQuery();
  const rows = Array.isArray(stks.data) ? stks.data : [];
  const balance = coins.data?.balance ?? 0;
  const earned = coins.data?.earned ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <header
        className="rounded-2xl p-6 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #ffe066 0%, #ffb07a 55%, #ff8fa3 100%)",
          border: "3px solid #ffffff",
          color: "#4a1a00",
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-70">Reagan's</div>
            <h1 className="font-display text-4xl md:text-5xl leading-tight">Sticker Book ⭐</h1>
            <p className="mt-2 text-sm opacity-90">Every block done = a sparkly new sticker.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold">
              ⭐ {rows.length} stickers
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold">
              🪙 {balance} coins
            </div>
            <div className="rounded-full bg-white/60 px-4 py-2 text-xs opacity-80">
              {earned} coins earned all-time
            </div>
          </div>
        </div>
      </header>

      {/* Empty state */}
      {!stks.isLoading && rows.length === 0 && (
        <Card className="classroom-card p-8 text-center">
          <div className="text-5xl mb-2">📖</div>
          <div className="font-display text-xl font-semibold chalk-white">Your sticker book is empty!</div>
          <p className="text-sm text-muted-foreground mt-2">
            Finish any block on your Today page to earn your very first sticker. Kiwi can't wait!
          </p>
        </Card>
      )}

      {/* Sticker grid */}
      {rows.length > 0 && (
        <section>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {rows.map((s: any) => (
              <div key={s.id} className="relative group">
                <StickerArt slug={s.art} palette={s.palette} />
                <div className="mt-1 text-[10px] text-center text-muted-foreground">
                  {new Date(s.awardedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                {s.shortLyric && (
                  <div className="absolute inset-x-0 bottom-6 mx-1 rounded-md bg-white/95 text-[10px] text-center px-1 py-0.5 opacity-0 group-hover:opacity-100 transition pointer-events-none shadow">
                    {s.shortLyric}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Good-work notes */}
      {Array.isArray(notes.data) && notes.data.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold chalk-white mb-2">Good-Work Notes 💌</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {notes.data.map((n: any) => (
              <Card key={n.id} className="classroom-card p-4">
                <div className="text-sm italic">"{n.lyric}"</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  — {n.authorName || "an adult"} · {new Date(n.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
