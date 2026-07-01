import { ReactNode } from "react";

/**
 * PageTitle — a floating liquid-glass title bubble (Katy design intent,
 * 2026-07-01). Page headings should read as an Apple "liquid glass" pill that
 * animates in on mount rather than a flat text header. When a subtitle or
 * trailing action is supplied they animate in one-by-one behind the title.
 *
 * Everything is transparent glass over the live nature scene; text carries a
 * shadow/scrim so it stays legible over any background.
 */
export default function PageTitle({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="page-title-row no-print">
      <div className="title-bubble" data-anim="pop">
        {icon && <span className="title-bubble-icon">{icon}</span>}
        <span className="title-bubble-text">{title}</span>
      </div>
      {subtitle && (
        <div className="title-subbubble" data-anim="pop" style={{ animationDelay: "120ms" }}>
          {subtitle}
        </div>
      )}
      {trailing && (
        <div className="title-trailing" data-anim="pop" style={{ animationDelay: "220ms" }}>
          {trailing}
        </div>
      )}
    </div>
  );
}
