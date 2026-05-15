/**
 * Wave-15 / Push 190 — kidLoginTroubleshooter
 *
 * PURE deterministic helper. No I/O. Takes the symptom Reagan reported
 * about an app she tried to open, plus the AppLinkSignInTag for that
 * app (from Push 184), and returns a kid-readable repair card.
 */

export type SignInMethod = "google_sso" | "email_password" | "class_code";
export type AccountRole = "reagan" | "mom" | "grandma" | "dad" | "none";

export type Symptom =
  | "page won't load"
  | "wrong password"
  | "says I'm not allowed"
  | "blank screen"
  | "asks for grown-up"
  | "other";

export interface AppLinkSignInTag {
  key: string;
  name: string;
  signInMethod: SignInMethod;
  preferredAccountRole: AccountRole;
  preferredAccountEmail: string | null;
  badge: string;
  adultNote: string | null;
}

export interface KidLoginTroubleshooterInput {
  tag: AppLinkSignInTag;
  symptom: Symptom;
  kidEmail: string | null;
}

export interface NotifyOwnerPayload {
  title: string;
  content: string;
}

export interface KidLoginRepairCard {
  headline: string;
  kidSteps: string[];
  escalateToGrownup: boolean;
  escalateReason: string | null;
  notifyOwnerPayload: NotifyOwnerPayload;
}

const BLOCKED_KID_EMAIL = "reagan.higgs33@ihsd.us";

function isGrownUpOwned(role: AccountRole): boolean {
  return role === "mom" || role === "grandma" || role === "dad";
}

function buildHeadline(tag: AppLinkSignInTag, symptom: Symptom): string {
  if (symptom === "asks for grown-up") {
    return `That's okay — ${tag.name} just needs a grown-up to set this up first.`;
  }
  if (symptom === "says I'm not allowed") {
    return `That's okay — we'll fix the account for ${tag.name}.`;
  }
  if (symptom === "page won't load" || symptom === "blank screen") {
    return `That's okay — ${tag.name} might just need a fresh start.`;
  }
  if (symptom === "wrong password") {
    return `That's okay — passwords sometimes need a little help.`;
  }
  return `That's okay — let's check three things for ${tag.name}.`;
}

function buildKidSteps(tag: AppLinkSignInTag, symptom: Symptom): string[] {
  if (symptom === "page won't load" || symptom === "blank screen") {
    return [
      "Tap the round refresh arrow at the top of the page.",
      "Check that the wifi chick on the Today page isn't sad.",
      "Wait 5 minutes and try again — sometimes apps just need a snack break.",
    ];
  }
  if (symptom === "wrong password" && tag.signInMethod === "class_code") {
    return [
      "Look at your class-code sticker in your binder.",
      "Type each letter slowly — capitals matter.",
      "If it still says no, ask your teacher next school day.",
    ];
  }
  if (symptom === "wrong password") {
    return [
      "Tap Kiwi and say 'my password isn't working for " + tag.name + "'.",
      "A grown-up will get a phone ping to fix it.",
    ];
  }
  if (symptom === "says I'm not allowed") {
    return [
      "Make sure you signed in with your own Reagan account, not your old school one.",
      "Tap Kiwi and say 'wrong account on " + tag.name + "'.",
    ];
  }
  if (symptom === "asks for grown-up") {
    return [
      "Tap Kiwi and say '" + tag.name + " needs a grown-up sign-in'.",
      "You can keep going with something else in the meantime — pick another app on this page.",
    ];
  }
  return [
    "Tap Kiwi and tell her what you see on the screen.",
    "She'll figure out if a grown-up needs to help or if it's something easy.",
  ];
}

function decideEscalation(
  tag: AppLinkSignInTag,
  symptom: Symptom,
  kidEmail: string | null
): { escalate: boolean; reason: string | null } {
  if (symptom === "asks for grown-up") {
    return { escalate: true, reason: `${tag.name} needs a one-time grown-up sign-in.` };
  }
  if (symptom === "says I'm not allowed" && kidEmail === BLOCKED_KID_EMAIL) {
    return {
      escalate: true,
      reason: `Reagan is signed in with the blocked IHSD email; switch to reaganhiggs910@gmail.com.`,
    };
  }
  if (symptom === "says I'm not allowed") {
    return {
      escalate: true,
      reason: `${tag.name} is rejecting Reagan's account — adult needs to check the roster.`,
    };
  }
  if (symptom === "wrong password" && tag.signInMethod === "class_code") {
    return { escalate: false, reason: null };
  }
  if (symptom === "wrong password") {
    return {
      escalate: true,
      reason: `${tag.name} password is adult-owned (${tag.signInMethod}); needs rotation via the vault.`,
    };
  }
  if (symptom === "page won't load" || symptom === "blank screen") {
    return { escalate: false, reason: null };
  }
  return { escalate: false, reason: null };
}

function buildNotifyOwnerPayload(
  tag: AppLinkSignInTag,
  symptom: Symptom,
  kidEmail: string | null,
  escalate: boolean,
  reason: string | null
): NotifyOwnerPayload {
  const tone = escalate ? "Reagan needs a hand" : "FYI";
  const title = `${tone}: ${tag.name} sign-in (${symptom})`;
  const ownerLine = isGrownUpOwned(tag.preferredAccountRole)
    ? `Owned by ${tag.preferredAccountRole}.`
    : `Kid-managed.`;
  const emailLine = kidEmail
    ? `Reagan signed in as: ${kidEmail}.`
    : `Reagan account: unknown.`;
  const reasonLine = reason ? `Reason: ${reason}` : `Reason: kid-side self-help should resolve.`;
  const content = [
    `App: ${tag.name} (${tag.key}) — ${tag.signInMethod}.`,
    ownerLine,
    emailLine,
    reasonLine,
  ].join(" ");
  return { title, content };
}

export function diagnoseKidLogin(
  input: KidLoginTroubleshooterInput
): KidLoginRepairCard {
  const { tag, symptom, kidEmail } = input;
  const headline = buildHeadline(tag, symptom);
  const kidSteps = buildKidSteps(tag, symptom);
  const { escalate, reason } = decideEscalation(tag, symptom, kidEmail);
  const notifyOwnerPayload = buildNotifyOwnerPayload(
    tag,
    symptom,
    kidEmail,
    escalate,
    reason
  );
  return {
    headline,
    kidSteps,
    escalateToGrownup: escalate,
    escalateReason: reason,
    notifyOwnerPayload,
  };
}

export const __FOR_TEST__ = {
  BLOCKED_KID_EMAIL,
  isGrownUpOwned,
  buildHeadline,
  buildKidSteps,
  decideEscalation,
  buildNotifyOwnerPayload,
};
