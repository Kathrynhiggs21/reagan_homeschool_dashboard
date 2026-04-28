import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Adult Whiteboard — dashboard for parents/tutor to post sticky notes
 * that show up on Reagan's Today page. Adult-only.
 */

const COLORS = [
  { slug: "butter",   bg: "#ffe680" },
  { slug: "coral",    bg: "#ffa3b5" },
  { slug: "mint",     bg: "#a8efd5" },
  { slug: "sky",      bg: "#a5d8ff" },
  { slug: "lavender", bg: "#d8c3ff" },
  { slug: "peach",    bg: "#ffcaa3" },
  { slug: "pink",     bg: "#ffc4e0" },
] as const;
type ColorSlug = typeof COLORS[number]["slug"];

const EMOJI_OPTIONS = ["💛", "🌈", "⭐", "🪶", "🦜", "💖", "🌱", "☀️", "🍎", "✨", "📌", "🎨"];

export default function Whiteboard() {
  const list = trpc.whiteboard.list.useQuery({ includeArchived: true });
  const utils = trpc.useUtils();
  const post = trpc.whiteboard.post.useMutation({
    onSuccess: () => { utils.whiteboard.list.invalidate(); toast.success("Posted to Reagan's board"); },
    onError: (e) => toast.error(e.message || "Couldn't post"),
  });
  const update = trpc.whiteboard.update.useMutation({
    onSuccess: () => utils.whiteboard.list.invalidate(),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<ColorSlug>("butter");
  const [emoji, setEmoji] = useState("💛");
  const [pinned, setPinned] = useState(false);
  const [showOnDate, setShowOnDate] = useState(""); // "" = always show

  const notes = Array.isArray(list.data) ? list.data : [];

  const handlePost = () => {
    if (!body.trim()) {
      toast.error("Write something first");
      return;
    }
    post.mutate({
      title: title.trim() || null,
      body: body.trim(),
      color,
      emoji,
      pinned,
      showOnDate: showOnDate || null,
    }, {
      onSuccess: () => {
        setTitle("");
        setBody("");
        setPinned(false);
        setShowOnDate("");
      },
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Adults only</div>
        <h1 className="font-display text-3xl font-semibold chalk-white">Whiteboard 📌</h1>
        <p className="text-sm text-muted-foreground">
          Post sticky notes, encouragement, reminders, or "this is what we're doing today." They appear on Reagan's Today page.
        </p>
      </header>

      {/* Compose card */}
      <Card className="classroom-card p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For your morning ⭐" />
          </div>
          <div>
            <Label className="text-xs">Only show on this date (optional)</Label>
            <Input
              type="date"
              value={showOnDate}
              onChange={(e) => setShowOnDate(e.target.value)}
              placeholder="(blank = always)"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Note</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hey love — today is a tour day. Just peek around. I'm so proud of you. 💛 — Mom"
            rows={4}
          />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs mb-1 block">Color</Label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  aria-label={c.slug}
                  onClick={() => setColor(c.slug)}
                  className="w-7 h-7 rounded-full border-2 transition"
                  style={{
                    background: c.bg,
                    borderColor: color === c.slug ? "#1f2937" : "rgba(255,255,255,0.4)",
                    transform: color === c.slug ? "scale(1.12)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Emoji</Label>
            <div className="flex gap-1 flex-wrap max-w-[320px]">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className="w-7 h-7 rounded-md text-base border transition"
                  style={{
                    borderColor: emoji === e ? "#1f2937" : "transparent",
                    background: emoji === e ? "rgba(255,255,255,0.12)" : "transparent",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to top
          </label>
          <div className="ml-auto">
            <Button onClick={handlePost} disabled={post.isPending} className="rounded-full">
              {post.isPending ? "Posting…" : "Post to Reagan's board"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Current board */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xl font-semibold chalk-white">Current board</div>
          <div className="text-xs text-muted-foreground">{notes.length} note{notes.length === 1 ? "" : "s"}</div>
        </div>
        {notes.length === 0 && (
          <Card className="classroom-card p-6 text-center text-sm text-muted-foreground">
            No notes yet. Post the first one above — Reagan will see it immediately.
          </Card>
        )}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {notes.map((n: any) => {
            const c = COLORS.find((cc) => cc.slug === n.color) || COLORS[0];
            return (
              <div
                key={n.id}
                className="rounded-[14px] p-3 relative"
                style={{
                  background: c.bg,
                  color: "#1f2937",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)",
                  opacity: n.archived ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold opacity-80 mb-1">
                  <span>{n.authorAvatar || (n.authorName || "A").slice(0, 1)}</span>
                  <span>{n.authorName}</span>
                  {n.pinned && <span className="ml-auto">📌</span>}
                </div>
                {n.title && <div className="font-semibold text-sm">{n.emoji} {n.title}</div>}
                <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                {n.showOnDate && (
                  <div className="mt-1 text-[10px] opacity-70">
                    Shows only on {new Date(n.showOnDate).toLocaleDateString()}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span>❤️ {n.heartCount || 0}{n.reaganHearted ? " (hearted)" : ""}</span>
                  <button
                    className="ml-auto underline"
                    onClick={() => update.mutate({ id: n.id, pinned: !n.pinned })}
                  >
                    {n.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    className="underline"
                    onClick={() => update.mutate({ id: n.id, archived: !n.archived })}
                  >
                    {n.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
