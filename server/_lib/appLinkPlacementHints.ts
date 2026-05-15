/**
 * Wave-15 / Push 192 — appLinkPlacementHints
 *
 * PURE deterministic helper. No I/O. Takes a list of AppLinkSignInTag
 * rows (Push 184) + the current subject focus, and returns the Today
 * page rail order Reagan sees.
 */

export type SignInMethod = "google_sso" | "email_password" | "class_code";
export type AccountRole = "reagan" | "mom" | "grandma" | "dad" | "none";

export type SubjectFocus =
  | "reading"
  | "math"
  | "writing"
  | "science"
  | "art"
  | "social_studies"
  | "free_choice";

export interface AppLinkSignInTag {
  key: string;
  name: string;
  signInMethod: SignInMethod;
  preferredAccountRole: AccountRole;
  preferredAccountEmail: string | null;
  badge: string;
  adultNote: string | null;
}

export interface PlacementSlot {
  key: string;
  name: string;
  railPosition: number;
  badgeColor: "green" | "blue" | "purple" | "yellow" | "gray";
  pinnedForSubject: boolean;
  pinReason: string | null;
  overflow: boolean;
}

export interface PlacementHints {
  subject: SubjectFocus;
  ordered: PlacementSlot[];
  heroStrip: PlacementSlot[];
  overflowCount: number;
}

const BLOCKED_KID_EMAIL = "reagan.higgs33@ihsd.us";
const HERO_LIMIT = 3;
const RAIL_LIMIT = 8;

const SUBJECT_PINS: Record<SubjectFocus, string[]> = {
  reading: ["pear", "khan"],
  math: ["ixl", "khan"],
  writing: ["bookcreator", "vocab"],
  science: ["brainpop", "inaturalist"],
  art: ["canva", "bookcreator"],
  social_studies: ["brainpop", "khan"],
  free_choice: [],
};

function badgeColorFor(tag: AppLinkSignInTag): PlacementSlot["badgeColor"] {
  if (tag.signInMethod === "class_code") return "yellow";
  if (tag.signInMethod === "google_sso") {
    if (tag.preferredAccountRole === "reagan") return "green";
    return "blue";
  }
  if (tag.signInMethod === "email_password") return "purple";
  return "gray";
}

function isBlocked(tag: AppLinkSignInTag): boolean {
  return tag.preferredAccountEmail === BLOCKED_KID_EMAIL;
}

function pinReasonFor(subject: SubjectFocus, key: string): string | null {
  const pins = SUBJECT_PINS[subject];
  const idx = pins.indexOf(key);
  if (idx === -1) return null;
  const ordinal = idx === 0 ? "primary" : "secondary";
  return `${ordinal} pick for ${subject.replace("_", " ")}`;
}

export function computeAppLinkPlacement(
  tags: AppLinkSignInTag[],
  subject: SubjectFocus
): PlacementHints {
  const visible = tags.filter((t) => !isBlocked(t));
  const pins = SUBJECT_PINS[subject];

  const pinnedTags: AppLinkSignInTag[] = [];
  for (const pk of pins) {
    const match = visible.find((t) => t.key === pk);
    if (match) pinnedTags.push(match);
  }

  const pinnedKeys = new Set(pinnedTags.map((t) => t.key));
  const rest = visible
    .filter((t) => !pinnedKeys.has(t.key))
    .sort((a, b) => a.name.localeCompare(b.name));

  const orderedTags = [...pinnedTags, ...rest];

  const ordered: PlacementSlot[] = orderedTags.map((t, i) => {
    const railPosition = i + 1;
    const pinned = pinnedKeys.has(t.key);
    return {
      key: t.key,
      name: t.name,
      railPosition,
      badgeColor: badgeColorFor(t),
      pinnedForSubject: pinned,
      pinReason: pinned ? pinReasonFor(subject, t.key) : null,
      overflow: railPosition > RAIL_LIMIT,
    };
  });

  const heroStrip = ordered.slice(0, HERO_LIMIT);
  const overflowCount = ordered.filter((s) => s.overflow).length;

  return {
    subject,
    ordered,
    heroStrip,
    overflowCount,
  };
}

export const __FOR_TEST__ = {
  BLOCKED_KID_EMAIL,
  HERO_LIMIT,
  RAIL_LIMIT,
  SUBJECT_PINS,
  badgeColorFor,
  isBlocked,
  pinReasonFor,
};
