import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { usePracticePrefs } from "@/hooks/usePracticePrefs";

export default function PracticePrefsCard() {
  const { prefs, update } = usePracticePrefs();
  return (
    <Card className="cozy-card p-4 space-y-3">
      <div>
        <h3 className="font-display font-semibold text-base">Practice-link mode</h3>
        <p className="text-xs text-muted-foreground">
          How the Khan / IXL buttons on curriculum topics open when tapped.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <Switch
          checked={prefs.ihIxl}
          onCheckedChange={(v) => update({ ihIxl: Boolean(v) })}
        />
        <div className="flex-1">
          <div className="text-sm font-medium">Route IXL through Indian Hill SSO</div>
          <div className="text-xs text-muted-foreground">
            When on, IXL links go through <code className="text-[10px]">ixl.com/signin/indianhill</code>{" "}
            so Reagan lands logged in with her IH account (SmartScore + diagnostic).
            Turn off to use the public IXL search that paywalls at ~10 problems/day.
          </div>
        </div>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <Switch
          checked={prefs.khanKids}
          onCheckedChange={(v) => update({ khanKids: Boolean(v) })}
        />
        <div className="flex-1">
          <div className="text-sm font-medium">Use Khan Kids on scaffolded topics</div>
          <div className="text-xs text-muted-foreground">
            When on, topics a tutor has flagged as scaffolded (notes mention
            <em> scaffold / below-grade / kids</em>) open on Khan Academy Kids instead
            of regular Khan. Great for giving Reagan age-appropriate UI on sub-skills
            where she's still building fluency.
          </div>
        </div>
      </label>

      <div className="rounded-md border border-sky-300/60 bg-sky-50 dark:bg-sky-900/20 p-3">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <span aria-hidden>🔑</span> First-time IXL setup (one time only)
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          On a Family membership IXL can't auto-log-in from this app, but you only
          have to sign in <strong>once</strong> on Reagan's device:
        </p>
        <ol className="text-xs text-muted-foreground mt-1 list-decimal pl-4 space-y-0.5">
          <li>Open IXL on her tablet/laptop and sign in with her username + password.</li>
          <li>When the browser asks <em>“Save password?”</em> tap <strong>Save</strong>, and check <em>“keep me signed in”</em> on IXL.</li>
          <li>After that, every IXL button here drops her straight on the exact skill — already signed in, no password to type.</li>
        </ol>
      </div>
    </Card>
  );
}
