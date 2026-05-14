/**
 * Push 184 (Wave-15, 2026-05-15) — appLink sign-in-method tagger.
 *
 * Pure, deterministic. Takes a thin appLink row (key/url/name) and
 * returns the canonical sign-in method + preferred Google account +
 * a kid-readable badge.
 *
 * House rules encoded:
 *  - reaganhiggs910@gmail.com is the ONLY allowed Reagan account.
 *    reagan.higgs33@ihsd.us is hard-blocked everywhere — if a row
 *    is tagged for Reagan, the resolved email NEVER includes ihsd.us.
 *  - Mom = spear.cpt@gmail.com; Grandma = marcy.spear@gmail.com;
 *    Dad email is intentionally NOT autofilled (Mom hasn't set it
 *    yet) — we surface "dad" as the role only.
 *  - No punitive/scolding badges; if we don't know an account yet,
 *    we say "Ask a grown-up to set this up", same opt-in language as
 *    the Pear Classes chip.
 *  - Never throws on malformed input.
 */

export type SignInMethod = "google_sso" | "email_password" | "class_code";
export type PreferredAccountRole =
  | "reagan"
  | "mom"
  | "grandma"
  | "dad"
  | "none";

export type AppLinkSignInTag = {
  appKey: string;
  signInMethod: SignInMethod;
  preferredAccountRole: PreferredAccountRole;
  preferredAccountEmail: string | null;
  kidBadge: string;
  adultNote: string | null;
  canKidOpenNow: boolean;
};

export type AppLinkSignInTaggerInput = {
  appKey: string;
  name?: string | null;
  url?: string | null;
  isReaganView?: boolean;
};

const REAGAN_EMAIL = "reaganhiggs910@gmail.com";
const MOM_EMAIL = "spear.cpt@gmail.com";
const GRANDMA_EMAIL = "marcy.spear@gmail.com";
const BLOCKED_REAGAN_EMAILS = new Set<string>(["reagan.higgs33@ihsd.us"]);

type CanonicalRow = {
  signInMethod: SignInMethod;
  preferredAccountRole: PreferredAccountRole;
};

const CANONICAL: Record<string, CanonicalRow> = {
  // Reagan-account Google-SSO learning apps
  khan_academy: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  brainpop: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  edpuzzle: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  seesaw: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  code_org: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  book_creator: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  inaturalist: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  merlin: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  vocab_com: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  canva: { signInMethod: "google_sso", preferredAccountRole: "reagan" },
  // Mom-account Google-SSO (parent dashboards / library)
  pear_classes_giant_steps: {
    signInMethod: "google_sso",
    preferredAccountRole: "mom",
  },
  // Class-code apps
  blooket: { signInMethod: "class_code", preferredAccountRole: "reagan" },
  wayground: { signInMethod: "class_code", preferredAccountRole: "reagan" },
  // Email/password parent-managed
  ixl: { signInMethod: "email_password", preferredAccountRole: "dad" },
  prodigy: { signInMethod: "email_password", preferredAccountRole: "dad" },
  // School-account Google-SSO (intentionally surfaced as 'none' so the
  // tagger NEVER hands Reagan the blocked ihsd.us email).
  google_classroom: {
    signInMethod: "google_sso",
    preferredAccountRole: "none",
  },
  ihsd_gmail: { signInMethod: "google_sso", preferredAccountRole: "none" },
};

const NAME_ALIASES: Record<string, string> = {
  khan: "khan_academy",
  khanacademy: "khan_academy",
  "code.org": "code_org",
  "vocab.com": "vocab_com",
  vocabularycom: "vocab_com",
  vocab: "vocab_com",
  "pear classes": "pear_classes_giant_steps",
  pearclasses: "pear_classes_giant_steps",
  "giant steps": "pear_classes_giant_steps",
  giantsteps: "pear_classes_giant_steps",
};

const HOST_HINTS: Array<{ frag: string; key: string }> = [
  { frag: "khanacademy.org", key: "khan_academy" },
  { frag: "ixl.com", key: "ixl" },
  { frag: "prodigygame.com", key: "prodigy" },
  { frag: "brainpop.com", key: "brainpop" },
  { frag: "edpuzzle.com", key: "edpuzzle" },
  { frag: "vocabulary.com", key: "vocab_com" },
  { frag: "vocab.com", key: "vocab_com" },
  { frag: "blooket.com", key: "blooket" },
  { frag: "wayground.com", key: "wayground" },
  { frag: "seesaw.me", key: "seesaw" },
  { frag: "canva.com", key: "canva" },
  { frag: "code.org", key: "code_org" },
  { frag: "bookcreator.com", key: "book_creator" },
  { frag: "merlin.allaboutbirds.org", key: "merlin" },
  { frag: "inaturalist.org", key: "inaturalist" },
  { frag: "giantsteps.app", key: "pear_classes_giant_steps" },
  { frag: "classroom.google.com", key: "google_classroom" },
  { frag: "mail.google.com", key: "ihsd_gmail" },
];

function normalize(s: string | null | undefined): string {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

function resolveCanonicalKey(input: AppLinkSignInTaggerInput): string | null {
  const directKey = normalize(input.appKey);
  if (directKey && CANONICAL[directKey]) return directKey;
  const candidates = [directKey, normalize(input.name)].filter(
    (s) => s.length > 0,
  );
  for (const cand of candidates) {
    const compact = cand.replace(/\s+/g, "");
    if (NAME_ALIASES[cand]) return NAME_ALIASES[cand];
    if (NAME_ALIASES[compact]) return NAME_ALIASES[compact];
  }
  const url = normalize(input.url);
  if (url.length > 0) {
    for (const { frag, key } of HOST_HINTS) {
      if (url.includes(frag)) return key;
    }
  }
  return null;
}

function resolveEmailForRole(role: PreferredAccountRole): string | null {
  switch (role) {
    case "reagan":
      return REAGAN_EMAIL;
    case "mom":
      return MOM_EMAIL;
    case "grandma":
      return GRANDMA_EMAIL;
    case "dad":
      return null;
    case "none":
    default:
      return null;
  }
}

function sanitizeReaganEmail(email: string | null): string | null {
  if (!email) return null;
  if (BLOCKED_REAGAN_EMAILS.has(email.toLowerCase())) return REAGAN_EMAIL;
  return email;
}

export function tagAppLinkSignInMethod(
  input: AppLinkSignInTaggerInput,
): AppLinkSignInTag {
  const safeKey = typeof input?.appKey === "string" ? input.appKey : "";
  const isKid = input?.isReaganView === true;
  const canonical = resolveCanonicalKey({ ...input, appKey: safeKey });

  let signInMethod: SignInMethod;
  let role: PreferredAccountRole;

  if (canonical && CANONICAL[canonical]) {
    signInMethod = CANONICAL[canonical].signInMethod;
    role = CANONICAL[canonical].preferredAccountRole;
  } else {
    signInMethod = "email_password";
    role = "none";
  }

  let email = resolveEmailForRole(role);
  if (role === "reagan") email = sanitizeReaganEmail(email);

  let kidBadge: string;
  let adultNote: string | null;
  let canKidOpenNow: boolean;

  if (signInMethod === "google_sso") {
    if (role === "none" || email === null) {
      kidBadge = "Ask a grown-up to set this up";
      adultNote = isKid
        ? null
        : `Google sign-in needed — pick which adult account to use.`;
      canKidOpenNow = false;
    } else if (role === "reagan") {
      kidBadge = "Sign in with Google";
      adultNote = isKid ? null : `Reagan signs in with ${email}.`;
      canKidOpenNow = true;
    } else {
      kidBadge = "Ask a grown-up to set this up";
      adultNote = isKid ? null : `Adult signs in with ${email ?? "(set me)"}.`;
      canKidOpenNow = false;
    }
  } else if (signInMethod === "class_code") {
    kidBadge = "Use class code";
    adultNote = isKid ? null : `No login — Reagan enters the class code.`;
    canKidOpenNow = true;
  } else {
    kidBadge = "Ask a grown-up to set this up";
    adultNote = isKid
      ? null
      : role === "dad"
        ? `Parent account — saved in the adult-only vault.`
        : `Saved in the adult-only password vault.`;
    canKidOpenNow = false;
  }

  return {
    appKey: safeKey,
    signInMethod,
    preferredAccountRole: role,
    preferredAccountEmail: email,
    kidBadge,
    adultNote,
    canKidOpenNow,
  };
}
