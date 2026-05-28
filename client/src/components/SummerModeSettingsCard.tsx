import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Push 72 (2026-05-13) — Slice 5 summer-mode settings card.
 * Updated 2026-05-28 — added day length (2-5hr) and flexible start time settings.
 *
 * Mom-side editor for the 7 summer.* keys in `prefs`:
 *   summer.autoFlipEnabled    "1" | "0"
 *   summer.start              "MM-DD"
 *   summer.end                "MM-DD"
 *   summer.override           "on" | "off" | null
 *   summer.vacationRanges     JSON [{start,end}, ...]
 *   summer.dayLengthMin       "2" (hours, default 2)
 *   summer.dayLengthMax       "5" (hours, default 5)
 *   summer.startTimeDefault   "10:00" (default school start, flexible)
 *
 * The same priority order the badge and the server use:
 *   override "off" > vacation > override "on" > auto window
 *
 * Card self-renders even when no settings exist (defaults to Jun 6 → Aug 15).
 */

const DEFAULT_START = "06-06";
const DEFAULT_END = "08-15";

type VacationRange = { start: string; end: string; label?: string };

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isValidMMDD(s: string): boolean {
  return /^\d{2}-\d{2}$/.test(s);
}

function isValidISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseVacationRanges(raw: string | null | undefined): VacationRange[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: any) => r && isValidISO(r.start) && isValidISO(r.end) && r.start <= r.end,
    );
  } catch {
    return [];
  }
}

export default function SummerModeSettingsCard() {
  const autoFlip = trpc.prefs.get.useQuery({ key: "summer.autoFlipEnabled" });
  const start = trpc.prefs.get.useQuery({ key: "summer.start" });
  const end = trpc.prefs.get.useQuery({ key: "summer.end" });
  const override = trpc.prefs.get.useQuery({ key: "summer.override" });
  const vacationRangesQ = trpc.prefs.get.useQuery({ key: "summer.vacationRanges" });
  const dayLengthMin = trpc.prefs.get.useQuery({ key: "summer.dayLengthMin" });
  const dayLengthMax = trpc.prefs.get.useQuery({ key: "summer.dayLengthMax" });
  const startTimeDefault = trpc.prefs.get.useQuery({ key: "summer.startTimeDefault" });

  const utils = trpc.useUtils();
  const setPref = trpc.prefs.set.useMutation({
    onSuccess: () => {
      void utils.prefs.get.invalidate();
      void utils.prefs.getPublic.invalidate();
    },
  });

  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");
  const [autoFlipOn, setAutoFlipOn] = useState<boolean>(true);
  const [overrideValue, setOverrideValue] = useState<string>("auto");
  const [ranges, setRanges] = useState<VacationRange[]>([]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [dayMinInput, setDayMinInput] = useState<string>("2");
  const [dayMaxInput, setDayMaxInput] = useState<string>("5");
  const [startTimeInput, setStartTimeInput] = useState<string>("10:00");

  // Hydrate local state from server once
  useEffect(() => {
    if (start.data !== undefined) setStartInput((start.data as string | null) ?? DEFAULT_START);
  }, [start.data]);
  useEffect(() => {
    if (end.data !== undefined) setEndInput((end.data as string | null) ?? DEFAULT_END);
  }, [end.data]);
  useEffect(() => {
    if (autoFlip.data !== undefined) {
      setAutoFlipOn(((autoFlip.data as string | null) ?? "1") !== "0");
    }
  }, [autoFlip.data]);
  useEffect(() => {
    if (override.data !== undefined) {
      const v = (override.data as string | null) ?? null;
      setOverrideValue(v ?? "auto");
    }
  }, [override.data]);
  useEffect(() => {
    if (vacationRangesQ.data !== undefined) {
      setRanges(parseVacationRanges(vacationRangesQ.data as string | null));
    }
  }, [vacationRangesQ.data]);
  useEffect(() => {
    if (dayLengthMin.data !== undefined) setDayMinInput((dayLengthMin.data as string | null) ?? "2");
  }, [dayLengthMin.data]);
  useEffect(() => {
    if (dayLengthMax.data !== undefined) setDayMaxInput((dayLengthMax.data as string | null) ?? "5");
  }, [dayLengthMax.data]);
  useEffect(() => {
    if (startTimeDefault.data !== undefined) setStartTimeInput((startTimeDefault.data as string | null) ?? "10:00");
  }, [startTimeDefault.data]);

  const today = todayIso();
  const todayMMDD = today.slice(5);
  const inAutoWindow = startInput && endInput && todayMMDD >= startInput && todayMMDD <= endInput;
  const inVacation = useMemo(
    () => ranges.some((r) => today >= r.start && today <= r.end),
    [ranges, today],
  );

  let liveActive = false;
  let liveReason = "off";
  if (overrideValue === "off") {
    liveActive = false;
    liveReason = "manual-off";
  } else if (overrideValue !== "on" && inVacation) {
    liveActive = false;
    liveReason = "vacation";
  } else if (overrideValue === "on") {
    liveActive = true;
    liveReason = "manual-on";
  } else if (autoFlipOn && inAutoWindow) {
    liveActive = true;
    liveReason = "auto";
  }

  const handleSaveWindow = async () => {
    if (!isValidMMDD(startInput) || !isValidMMDD(endInput)) {
      toast.error("Use MM-DD format (e.g. 06-06).");
      return;
    }
    if (startInput >= endInput) {
      toast.error("Start must come before end.");
      return;
    }
    await setPref.mutateAsync({ key: "summer.start", value: startInput });
    await setPref.mutateAsync({ key: "summer.end", value: endInput });
    toast.success("Summer window saved.");
  };

  const handleAutoFlipToggle = async (next: boolean) => {
    setAutoFlipOn(next);
    await setPref.mutateAsync({ key: "summer.autoFlipEnabled", value: next ? "1" : "0" });
  };

  const handleOverride = async (next: string) => {
    setOverrideValue(next);
    await setPref.mutateAsync({
      key: "summer.override",
      value: next === "auto" ? null : next,
    });
  };

  const persistRanges = async (next: VacationRange[]) => {
    setRanges(next);
    await setPref.mutateAsync({ key: "summer.vacationRanges", value: JSON.stringify(next) });
  };

  const addRange = async () => {
    if (!isValidISO(newStart) || !isValidISO(newEnd)) {
      toast.error("Use YYYY-MM-DD for dates.");
      return;
    }
    if (newStart > newEnd) {
      toast.error("Start must come before end.");
      return;
    }
    const next = [...ranges, { start: newStart, end: newEnd, label: newLabel || undefined }];
    await persistRanges(next);
    setNewStart("");
    setNewEnd("");
    setNewLabel("");
    toast.success("Vacation added.");
  };

  const removeRange = async (idx: number) => {
    const next = ranges.filter((_, i) => i !== idx);
    await persistRanges(next);
  };

  const handleSaveDaySettings = async () => {
    const min = parseInt(dayMinInput);
    const max = parseInt(dayMaxInput);
    if (isNaN(min) || isNaN(max) || min < 1 || max > 8 || min > max) {
      toast.error("Day length must be 1–8 hours, min ≤ max.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTimeInput)) {
      toast.error("Start time must be HH:MM (e.g. 10:00).");
      return;
    }
    await setPref.mutateAsync({ key: "summer.dayLengthMin", value: String(min) });
    await setPref.mutateAsync({ key: "summer.dayLengthMax", value: String(max) });
    await setPref.mutateAsync({ key: "summer.startTimeDefault", value: startTimeInput });
    toast.success("Summer day settings saved.");
  };

  const loading =
    autoFlip.isLoading ||
    start.isLoading ||
    end.isLoading ||
    override.isLoading ||
    vacationRangesQ.isLoading;

  return (
    <Card data-testid="summer-mode-settings-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" /> Summer mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge
                className={
                  liveActive
                    ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                    : "bg-muted text-muted-foreground"
                }
                data-testid="summer-live-status"
              >
                {liveActive ? "Active today" : "Off today"}
              </Badge>
              <span className="text-xs text-muted-foreground">Reason: {liveReason}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Switch
                id="summer-autoflip"
                checked={autoFlipOn}
                onCheckedChange={handleAutoFlipToggle}
              />
              <Label htmlFor="summer-autoflip" className="cursor-pointer">
                Auto-flip into summer mode between the dates below
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <Label htmlFor="summer-start" className="text-xs">Start (MM-DD)</Label>
                <Input
                  id="summer-start"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  placeholder="06-06"
                />
              </div>
              <div>
                <Label htmlFor="summer-end" className="text-xs">End (MM-DD)</Label>
                <Input
                  id="summer-end"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  placeholder="08-15"
                />
              </div>
              <div className="col-span-2">
                <Button size="sm" variant="outline" onClick={handleSaveWindow}>
                  Save window
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Manual override (beats the auto window)
              </Label>
              <div className="flex gap-2">
                {(["auto", "on", "off"] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={overrideValue === v ? "default" : "outline"}
                    onClick={() => handleOverride(v)}
                    data-testid={`summer-override-${v}`}
                  >
                    {v === "auto" ? "Auto" : v === "on" ? "Force on" : "Force off"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Vacations (force summer mode off on these days)
              </Label>
              {ranges.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  No vacation ranges yet.
                </p>
              ) : (
                <ul className="space-y-1" data-testid="summer-vacation-list">
                  {ranges.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono">{r.start}</span>
                      <span>→</span>
                      <span className="font-mono">{r.end}</span>
                      {r.label && <span className="text-muted-foreground">· {r.label}</span>}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRange(i)}
                        aria-label="Remove vacation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-7 gap-2 items-end">
                <div className="col-span-2">
                  <Label htmlFor="vac-start" className="text-xs">Start</Label>
                  <Input
                    id="vac-start"
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="vac-end" className="text-xs">End</Label>
                  <Input
                    id="vac-end"
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="vac-label" className="text-xs">Label (optional)</Label>
                  <Input
                    id="vac-label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Beach trip"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={addRange}
                  aria-label="Add vacation"
                  data-testid="summer-add-vacation"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
