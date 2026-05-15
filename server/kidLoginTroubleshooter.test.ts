import { describe, it, expect } from "vitest";
import {
  diagnoseKidLogin,
  __FOR_TEST__,
  type AppLinkSignInTag,
  type Symptom,
} from "./_lib/kidLoginTroubleshooter";

function khanSsoMom(): AppLinkSignInTag {
  return {
    key: "khan",
    name: "Khan Academy",
    signInMethod: "google_sso",
    preferredAccountRole: "mom",
    preferredAccountEmail: "spear.cpt@gmail.com",
    badge: "Sign in with Mom's Google",
    adultNote: "google sso — owner: mom",
  };
}

function pearClassCode(): AppLinkSignInTag {
  return {
    key: "pear",
    name: "Pear Classes",
    signInMethod: "class_code",
    preferredAccountRole: "reagan",
    preferredAccountEmail: null,
    badge: "Use your class code",
    adultNote: null,
  };
}

function blooketEmail(): AppLinkSignInTag {
  return {
    key: "blooket",
    name: "Blooket",
    signInMethod: "email_password",
    preferredAccountRole: "mom",
    preferredAccountEmail: "spear.cpt@gmail.com",
    badge: "Mom signs in for this",
    adultNote: "email/password — owner: mom",
  };
}

describe("Push 190 — kidLoginTroubleshooter", () => {
  it("never blames Reagan in the headline", () => {
    const symptoms: Symptom[] = [
      "page won't load",
      "wrong password",
      "says I'm not allowed",
      "blank screen",
      "asks for grown-up",
      "other",
    ];
    for (const s of symptoms) {
      const r = diagnoseKidLogin({ tag: khanSsoMom(), symptom: s, kidEmail: null });
      expect(r.headline.toLowerCase()).not.toContain("you did");
      expect(r.headline.toLowerCase()).not.toContain("your fault");
      expect(r.headline.toLowerCase()).toContain("that's okay");
    }
  });

  it("never tells the kid to try a different password (security boundary)", () => {
    for (const tag of [khanSsoMom(), pearClassCode(), blooketEmail()]) {
      const r = diagnoseKidLogin({
        tag,
        symptom: "wrong password",
        kidEmail: "reaganhiggs910@gmail.com",
      });
      for (const step of r.kidSteps) {
        expect(step.toLowerCase()).not.toContain("try another password");
        expect(step.toLowerCase()).not.toContain("guess a new password");
        expect(step.toLowerCase()).not.toContain("change the password");
      }
    }
  });

  it("kid sees at most 3 self-help steps", () => {
    const symptoms: Symptom[] = [
      "page won't load",
      "wrong password",
      "says I'm not allowed",
      "blank screen",
      "asks for grown-up",
      "other",
    ];
    for (const s of symptoms) {
      const r = diagnoseKidLogin({ tag: khanSsoMom(), symptom: s, kidEmail: null });
      expect(r.kidSteps.length).toBeGreaterThanOrEqual(1);
      expect(r.kidSteps.length).toBeLessThanOrEqual(3);
    }
  });

  it("class_code + wrong password ⇒ NO escalation, kid asks teacher next day", () => {
    const r = diagnoseKidLogin({
      tag: pearClassCode(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.escalateToGrownup).toBe(false);
    expect(r.escalateReason).toBeNull();
    expect(r.kidSteps.join(" ").toLowerCase()).toContain("teacher");
  });

  it("google_sso + wrong password ⇒ ESCALATE (kid can't fix SSO)", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.escalateToGrownup).toBe(true);
    expect(r.escalateReason).toContain("adult-owned");
    expect(r.notifyOwnerPayload.title).toContain("Reagan needs a hand");
  });

  it("email_password + wrong password ⇒ ESCALATE", () => {
    const r = diagnoseKidLogin({
      tag: blooketEmail(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.escalateToGrownup).toBe(true);
    expect(r.escalateReason).toContain("adult-owned");
  });

  it("asks for grown-up ⇒ always ESCALATE", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "asks for grown-up",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.escalateToGrownup).toBe(true);
    expect(r.escalateReason).toContain("one-time grown-up sign-in");
  });

  it("says-I'm-not-allowed + blocked IHSD email ⇒ ESCALATE with specific reason", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "says I'm not allowed",
      kidEmail: "reagan.higgs33@ihsd.us",
    });
    expect(r.escalateToGrownup).toBe(true);
    expect(r.escalateReason).toContain("blocked IHSD");
    expect(r.escalateReason).toContain("reaganhiggs910@gmail.com");
  });

  it("says-I'm-not-allowed + good email ⇒ ESCALATE roster-check reason", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "says I'm not allowed",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.escalateToGrownup).toBe(true);
    expect(r.escalateReason).toContain("roster");
  });

  it("page won't load ⇒ NO escalation, kid steps include refresh + wifi + wait", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "page won't load",
      kidEmail: null,
    });
    expect(r.escalateToGrownup).toBe(false);
    const joined = r.kidSteps.join(" ").toLowerCase();
    expect(joined).toContain("refresh");
    expect(joined).toContain("wifi");
    expect(joined).toContain("5 minutes");
  });

  it("blank screen ⇒ NO escalation, same self-help bucket", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "blank screen",
      kidEmail: null,
    });
    expect(r.escalateToGrownup).toBe(false);
    expect(r.kidSteps.join(" ").toLowerCase()).toContain("refresh");
  });

  it("'other' ⇒ NO escalation, defers to Kiwi", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "other",
      kidEmail: null,
    });
    expect(r.escalateToGrownup).toBe(false);
    expect(r.kidSteps.join(" ").toLowerCase()).toContain("kiwi");
  });

  it("notifyOwner title encodes tone, app name, and symptom", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.notifyOwnerPayload.title).toContain("Khan Academy");
    expect(r.notifyOwnerPayload.title).toContain("wrong password");
    expect(r.notifyOwnerPayload.title).toContain("Reagan needs a hand");
  });

  it("notifyOwner content is FYI when escalate=false", () => {
    const r = diagnoseKidLogin({
      tag: pearClassCode(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.notifyOwnerPayload.title).toContain("FYI");
    expect(r.notifyOwnerPayload.content).toContain("self-help");
  });

  it("notifyOwner content carries the app key, method, and kid email", () => {
    const r = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "asks for grown-up",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(r.notifyOwnerPayload.content).toContain("khan");
    expect(r.notifyOwnerPayload.content).toContain("google_sso");
    expect(r.notifyOwnerPayload.content).toContain("reaganhiggs910@gmail.com");
    expect(r.notifyOwnerPayload.content).toContain("Owned by mom");
  });

  it("isGrownUpOwned covers all roles deterministically", () => {
    expect(__FOR_TEST__.isGrownUpOwned("reagan")).toBe(false);
    expect(__FOR_TEST__.isGrownUpOwned("mom")).toBe(true);
    expect(__FOR_TEST__.isGrownUpOwned("grandma")).toBe(true);
    expect(__FOR_TEST__.isGrownUpOwned("dad")).toBe(true);
    expect(__FOR_TEST__.isGrownUpOwned("none")).toBe(false);
  });

  it("BLOCKED_KID_EMAIL constant matches the house rule", () => {
    expect(__FOR_TEST__.BLOCKED_KID_EMAIL).toBe("reagan.higgs33@ihsd.us");
  });

  it("deterministic — same input ⇒ same output", () => {
    const a = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    const b = diagnoseKidLogin({
      tag: khanSsoMom(),
      symptom: "wrong password",
      kidEmail: "reaganhiggs910@gmail.com",
    });
    expect(a).toEqual(b);
  });
});
