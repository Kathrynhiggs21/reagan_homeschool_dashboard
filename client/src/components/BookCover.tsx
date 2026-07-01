import { useState, useMemo } from "react";

/* ---------------------------------------------------------------------------
 * BookCover — a real, photographic book cover that stands on the glass shelf.
 *
 * Resolution order:
 *   1. stored coverUrl (from the DB) if present
 *   2. Open Library cover-by-title/author (free, no API key)
 *   3. a generated clear-glass "spine" showing the title (only if the image
 *      truly fails to load)
 *
 * The cover is a floating 3D object: soft cast shadow underneath, a thin
 * beveled light-rim, and a specular sheen — never a flat tile.
 * ------------------------------------------------------------------------- */

function openLibraryCover(title: string, author?: string | null): string {
  // Open Library has a title/author cover redirect that returns a real jacket
  // when it can match the work. Medium size ("M") is crisp on the shelf.
  const t = encodeURIComponent((title || "").trim());
  const a = encodeURIComponent((author || "").trim());
  return `https://covers.openlibrary.org/b/title/${t}-M.jpg?default=false${a ? `&author=${a}` : ""}`;
}

export default function BookCover({
  title,
  author,
  coverUrl,
  onClick,
  className = "",
}: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (coverUrl) list.push(coverUrl);
    if (title) list.push(openLibraryCover(title, author));
    return list;
  }, [coverUrl, title, author]);

  const [idx, setIdx] = useState(0);
  const failed = idx >= candidates.length;
  const src = failed ? null : candidates[idx];

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`book-cover-object group ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={`${title} cover`}
          loading="lazy"
          className="book-cover-img"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        // Clear-glass spine fallback — still a dimensional object, never flat.
        <span className="book-cover-fallback">
          <span className="book-cover-fallback-title">{title}</span>
          {author ? <span className="book-cover-fallback-author">{author}</span> : null}
        </span>
      )}
    </button>
  );
}
