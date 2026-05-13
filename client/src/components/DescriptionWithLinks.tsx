/**
 * Slice 4 push 12 (2026-05-12) — universal block-description renderer.
 *
 * Replaces raw {description} in block UI. Detects URLs in the text and:
 *   - YouTube link → renders the original clickable link AND a 16:9 embed
 *     iframe directly below it
 *   - Vimeo link → same treatment
 *   - Any other http(s) URL → renders as a clickable link, opens in new tab
 *   - Plain text fragments rendered as-is, preserving newlines.
 *
 * Drop-in replacement: pass `text` (or null/undefined). The component renders
 * nothing when text is empty.
 *
 * The pure detection / classification logic lives in `lib/videoLinks.ts` and
 * has its own vitests.
 */
import { splitWithLinks, youtubeEmbedUrl, vimeoEmbedUrl } from "@/lib/videoLinks";

type Props = {
  text?: string | null;
  /** When false, skips embed iframes and only renders clickable anchors. Defaults true. */
  embeds?: boolean;
  /** Tailwind classes applied to the outer wrapper. */
  className?: string;
};

export function DescriptionWithLinks({ text, embeds = true, className }: Props) {
  if (!text || !text.trim()) return null;
  const parts = splitWithLinks(text);
  return (
    <div className={className ?? "text-sm whitespace-pre-wrap"}>
      {parts.map((p, i) => {
        if (p.type === "text") {
          return <span key={`t${i}`}>{p.value}</span>;
        }
        const lk = p.link;
        if ((lk.kind === "youtube" || lk.kind === "vimeo") && embeds && lk.videoId) {
          const embedUrl =
            lk.kind === "youtube"
              ? youtubeEmbedUrl(lk.videoId)
              : vimeoEmbedUrl(lk.videoId);
          return (
            <span key={`l${i}`} className="block my-2">
              <a
                href={lk.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500 hover:text-blue-400 break-all"
              >
                {lk.href}
              </a>
              <span className="block mt-2 aspect-video w-full max-w-2xl rounded overflow-hidden border border-white/10 bg-black">
                <iframe
                  src={embedUrl}
                  title={lk.kind === "youtube" ? "YouTube video" : "Vimeo video"}
                  className="w-full h-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </span>
            </span>
          );
        }
        return (
          <a
            key={`l${i}`}
            href={lk.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-500 hover:text-blue-400 break-all"
          >
            {lk.href}
          </a>
        );
      })}
    </div>
  );
}

export default DescriptionWithLinks;
