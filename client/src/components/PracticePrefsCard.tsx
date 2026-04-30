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
    </Card>
  );
}
