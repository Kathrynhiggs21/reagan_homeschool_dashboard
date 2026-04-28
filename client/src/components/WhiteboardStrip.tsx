import { trpc } from "@/lib/trpc";
import { Heart } from "lucide-react";

/**
 * WhiteboardStrip — shows sticky notes parents/tutor have posted for Reagan.
 * Renders on the Today page between the flock and the schedule.
 * Reagan can heart any note (increments heartCount).
 */

const NOTE_BG: Record<string, { bg: string; ink: string }> = {
  butter:   { bg: "#ffe680", ink: "#4a3600" },
  coral:    { bg: "#ffa3b5", ink: "#5a0724" },
  mint:     { bg: "#a8efd5", ink: "#063c2d" },
  sky:      { bg: "#a5d8ff", ink: "#062a5c" },
  lavender: { bg: "#d8c3ff", ink: "#2a0e66" },
  peach:    { bg: "#ffcaa3", ink: "#4a1a00" },
  pink:     { bg: "#ffc4e0", ink: "#500724" },
};

export default function WhiteboardStrip() {
  const q = trpc.whiteboard.list.useQuery({ includeArchived: false });
  const utils = trpc.useUtils();
  const heartM = trpc.whiteboard.heart.useMutation({
    onSuccess: () => utils.whiteboard.list.invalidate(),
  });
  const notes = Array.isArray(q.data) ? q.data : [];
  if (q.isLoading) return null;
  if (notes.length === 0) return null;

  return (
    <section>
      <div className="font-display text-sm font-semibold chalk-white mb-1.5 flex items-center gap-2">
        <span>📌</span> <span>Notes for you</span>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {notes.map((n: any) => {
          const c = NOTE_BG[n.color as string] || NOTE_BG.butter;
          const tilt = (n.id % 5) - 2;
          return (
            <div
              key={n.id}
              className="rounded-[14px] p-3 shadow-sm relative"
              style={{
                background: c.bg,
                color: c.ink,
                transform: `rotate(${tilt * 0.4}deg)`,
                boxShadow: "0 2px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              {/* pin */}
              <div
                className="absolute -top-2 left-3 w-5 h-5 rounded-full"
                style={{ background: "#e11d48", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                aria-hidden
              />
              <div className="flex items-center gap-2 text-[11px] font-semibold opacity-75 mb-1">
                <span
                  className="inline-flex w-5 h-5 rounded-full bg-white/70 items-center justify-center text-[10px] font-bold"
                >
                  {n.authorAvatar || (n.authorName || "A").slice(0, 1)}
                </span>
                <span>{n.authorName || "an adult"}</span>
                {n.pinned && <span className="ml-auto text-[10px]">📌</span>}
              </div>
              {n.title && (
                <div className="font-display font-semibold text-sm leading-tight">
                  {n.emoji} {n.title}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap mt-0.5 leading-snug">{n.body}</div>
              <button
                onClick={() => heartM.mutate({ id: n.id })}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-white/70 hover:bg-white transition"
                title="Heart this note"
              >
                <Heart
                  className="w-3.5 h-3.5"
                  style={{
                    fill: n.reaganHearted ? "#e11d48" : "transparent",
                    color: n.reaganHearted ? "#e11d48" : "#7f1d1d",
                  }}
                />
                {n.heartCount || 0}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
