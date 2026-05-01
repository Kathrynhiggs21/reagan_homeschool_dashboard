/**
 * TopicLabel — small "Topic: Subject · Name" pill.
 *
 * Used on every schedule block, worksheet popup, video tile, lesson card,
 * and submission row so Reagan and any adult can always see what curriculum
 * topic a piece of work covers.
 */

export const SUBJECT_META: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  math:        { label: "Math",        color: "#fbbf24", emoji: "📐" },
  ela:         { label: "Reading & Writing", color: "#60a5fa", emoji: "📚" },
  reading:     { label: "Reading",     color: "#60a5fa", emoji: "📖" },
  writing:     { label: "Writing",     color: "#a78bfa", emoji: "✏️" },
  science:     { label: "Science",     color: "#34d399", emoji: "🔬" },
  ss:          { label: "Social Studies", color: "#f472b6", emoji: "🌍" },
  social_studies: { label: "Social Studies", color: "#f472b6", emoji: "🌍" },
  art:         { label: "Art",         color: "#f87171", emoji: "🎨" },
  music:       { label: "Music",       color: "#c084fc", emoji: "🎵" },
  pe:          { label: "Move",        color: "#facc15", emoji: "🤸" },
  outdoors:    { label: "Outdoors",    color: "#65a30d", emoji: "🌿" },
  wonder:      { label: "Wonder",      color: "#06b6d4", emoji: "💡" },
  adventure:   { label: "Adventure",   color: "#fb923c", emoji: "🗺️" },
  choice:      { label: "Choice",      color: "#94a3b8", emoji: "🎒" },
  catch_up:    { label: "Catch-up",    color: "#94a3b8", emoji: "🛠️" },
  read_aloud:  { label: "Read-aloud",  color: "#60a5fa", emoji: "🦉" },
  "brain-break": { label: "Brain Break", color: "#94a3b8", emoji: "🧠" },
};

export function subjectMeta(slug?: string | null) {
  if (!slug) return { label: "Topic", color: "#94a3b8", emoji: "📘" };
  return SUBJECT_META[slug] || { label: slug, color: "#94a3b8", emoji: "📘" };
}

interface Props {
  subjectSlug?: string | null;
  topicName?: string | null;
  className?: string;
  size?: "xs" | "sm";
}

export function TopicLabel({ subjectSlug, topicName, className = "", size = "sm" }: Props) {
  if (!subjectSlug && !topicName) return null;
  const meta = subjectMeta(subjectSlug);
  const padding = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-1";
  const text = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border bg-white/70 dark:bg-white/10 backdrop-blur ${padding} ${text} font-medium text-neutral-700 dark:text-neutral-100 ${className}`}
      style={{ borderColor: `${meta.color}55` }}
      title={topicName ? `Topic: ${meta.label} · ${topicName}` : `Subject: ${meta.label}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {topicName ? (
        <>
          <span className="opacity-70">Topic:</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="opacity-50">·</span>
          <span className="truncate max-w-[14rem]">{topicName}</span>
        </>
      ) : (
        <>
          <span className="opacity-70">Subject:</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
        </>
      )}
    </span>
  );
}

export default TopicLabel;
