import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

/**
 * Sticker Book — Reagan's collected stickers + Kiwi Coins balance.
 *
 * Redesign (Apr 30): drop the ombre gradient hero for a real sticker-book
 * look — tan paper with a scalloped-page header, striped spine on the left,
 * and two chunky pill counters. Prize currency labeled as "Kiwi Coins" 🪙
 * (matching Kiwi). Backend field names (coinCost, coins) are unchanged.
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
      {/* Sticker-book page header. Tan paper + scalloped bottom + spine stripe. */}
      <header className="relative">
        <div
          className="rounded-[20px] p-6 pl-12 shadow-[0_6px_0_rgba(0,0,0,0.12),0_20px_40px_-20px_rgba(0,0,0,0.4)]"
          style={{
            background:
              "repeating-linear-gradient(135deg, #fff8e6 0 24px, #fff3d4 24px 48px)",
            color: "#4a3600",
            border: "4px solid #ffffff",
            // scalloped lower edge
            WebkitMaskImage:
              "radial-gradient(14px at 14px 100%, transparent 98%, #000 100%) bottom left / 28px 14px repeat-x, linear-gradient(#000, #000)",
            maskImage:
              "radial-gradient(14px at 14px 100%, transparent 98%, #000 100%) bottom left / 28px 14px repeat-x, linear-gradient(#000, #000)",
          }}
        >
          {/* spiral-binding spine on the left */}
          <div
            className="absolute top-3 bottom-6 left-2 w-6 rounded-l-xl"
            style={{
              background:
                "repeating-linear-gradient(to bottom, #e7a96b 0 14px, #c98447 14px 18px)",
              boxShadow: "inset -1px 0 0 rgba(0,0,0,0.15)",
            }}
            aria-hidden
          />

          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-70">
                Reagan's
              </div>
              <h1 className="font-display text-4xl md:text-5xl leading-tight">
                Sticker Book <span aria-hidden>⭐</span>
              </h1>
              <p className="mt-2 text-sm opacity-90">
                Every block done = a sparkly new sticker.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div
                className="rounded-full px-4 py-2 text-sm font-extrabold flex items-center gap-1.5"
                style={{
                  background: "#fffdf7",
                  border: "3px solid #ffd97a",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
                  color: "#7a5200",
                }}
              >
                <span aria-hidden>⭐</span>
                <span className="tabular-nums">{rows.length}</span>
                <span className="opacity-70 font-semibold">stickers</span>
              </div>
              <div
                className="rounded-full px-4 py-2 text-sm font-extrabold flex items-center gap-1.5"
                style={{
                  background: "#fffdf7",
                  border: "3px solid #7fe3c4",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
                  color: "#0b4a38",
                }}
                title="Kiwi Coins — Kiwi's reward currency"
              >
                <span aria-hidden>🪶</span>
                <span className="tabular-nums">{balance}</span>
                <span className="opacity-70 font-semibold">Kiwi Coins</span>
              </div>
              <div
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: "#fffdf7aa", color: "#4a3600", border: "2px solid #e7d6a6" }}
              >
                {earned} Kiwi Coins earned all-time
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Empty state */}
      {!stks.isLoading && rows.length === 0 && (
        <Card className="classroom-card p-8 text-center">
          <div className="text-5xl mb-2">📖</div>
          <div className="font-display text-xl font-semibold chalk-white">
            Your sticker book is empty!
          </div>
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
