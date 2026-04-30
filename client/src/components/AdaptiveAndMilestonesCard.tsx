import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Trophy } from "lucide-react";

/**
 * Settings card with two adult-only controls:
 *   1. Adaptive IEP auto-apply toggle (reads/writes appSettings[iep.autoApply])
 *   2. Prize ladder milestones editor (comma-separated coin thresholds,
 *      stored in appSettings[prize.milestones])
 */
export function AdaptiveAndMilestonesCard() {
  const utils = trpc.useUtils();
  const autoApplyQ = trpc.prefs.get.useQuery({ key: "iep.autoApply" });
  const milestonesQ = trpc.prefs.get.useQuery({ key: "prize.milestones" });
  const setPref = trpc.prefs.set.useMutation({
    onSuccess: () => {
      utils.prefs.get.invalidate();
    },
  });

  const [autoApply, setAutoApply] = useState(false);
  const [milestonesStr, setMilestonesStr] = useState("10, 25, 50, 100");

  useEffect(() => {
    if (autoApplyQ.data != null) setAutoApply(autoApplyQ.data === "1");
  }, [autoApplyQ.data]);

  useEffect(() => {
    if (milestonesQ.data != null && milestonesQ.data.trim().length > 0) {
      setMilestonesStr(milestonesQ.data);
    }
  }, [milestonesQ.data]);

  function saveMilestones() {
    const nums = milestonesStr
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length === 0) {
      toast.error("Please enter at least one positive number");
      return;
    }
    const clean = Array.from(new Set(nums)).sort((a, b) => a - b).join(", ");
    setPref.mutate(
      { key: "prize.milestones", value: clean },
      {
        onSuccess: () => {
          setMilestonesStr(clean);
          toast.success("Prize ladder milestones saved");
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Adaptive + Rewards Tuning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Auto-apply IEP accommodations</div>
            <p className="text-sm text-muted-foreground max-w-md">
              When Kiwi detects stress or off-task signals, automatically apply
              Reagan's 6 seeded accommodations (extra time, shorter chunks,
              movement breaks, visual supports, reread-aloud, reduced volume).
              Leave off if you prefer to approve each adjustment manually.
            </p>
          </div>
          <Switch
            checked={autoApply}
            onCheckedChange={(v) => {
              setAutoApply(v);
              setPref.mutate({ key: "iep.autoApply", value: v ? "1" : "0" });
              toast.success(v ? "Auto-apply ON" : "Auto-apply OFF");
            }}
          />
        </div>

        <div className="border-t pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <div className="font-medium">Prize ladder milestones</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Coin thresholds shown as tick marks on the Rewards ladder. Comma-
            separated, ascending. Adjust as you add / remove prizes.
          </p>
          <Label htmlFor="milestones" className="sr-only">
            Milestones
          </Label>
          <div className="flex gap-2">
            <Input
              id="milestones"
              value={milestonesStr}
              onChange={(e) => setMilestonesStr(e.target.value)}
              placeholder="10, 25, 50, 100"
            />
            <Button onClick={saveMilestones} disabled={setPref.isPending}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
