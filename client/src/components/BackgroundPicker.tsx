/**
 * BackgroundPicker — small component Reagan or Mom can drop anywhere.
 * Picks a solid color or an uploaded image as the dashboard background.
 * Persists via CustomBackgroundContext (localStorage today).
 */
import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCustomBackground, readFileAsDataUrl } from "@/contexts/CustomBackgroundContext";
import { toast } from "sonner";

const PRESETS: Array<{ label: string; color: string }> = [
  { label: "Default",        color: "" }, // empty = clear
  { label: "Soft cream",     color: "#fdf6e3" },
  { label: "Mint",           color: "#d9f5e1" },
  { label: "Sky blue",       color: "#e0f2fe" },
  { label: "Pink cloud",     color: "#fce7f3" },
  { label: "Lavender",       color: "#ede9fe" },
  { label: "Sunny yellow",   color: "#fef9c3" },
  { label: "Peach",          color: "#fed7aa" },
  { label: "Mocha",          color: "#3a2e26" },
  { label: "Midnight",       color: "#0f172a" },
];

export default function BackgroundPicker({ compact = false }: { compact?: boolean }) {
  const { bg, setColor, setImage, clear } = useCustomBackground();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await readFileAsDataUrl(f, 1_500_000);
    if (!dataUrl) {
      toast.error("That image is too big — please pick one under 1.5 MB.");
      return;
    }
    setImage(dataUrl);
    toast.success("Background updated.");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className={`p-4 space-y-3 ${compact ? "" : "classroom-card"}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">Pick your background</div>
          <div className="text-[11px] text-muted-foreground">
            Choose a color, or upload your own picture.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={clear} className="bg-transparent">
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => (p.color ? setColor(p.color) : clear())}
            title={p.label}
            className={`h-10 rounded-md border transition-transform hover:scale-105 ${
              bg.kind === "color" && bg.color === p.color
                ? "ring-2 ring-primary"
                : ""
            } ${!p.color ? "bg-white/10" : ""}`}
            style={p.color ? { background: p.color } : undefined}
          >
            {!p.color && <span className="text-[10px]">Default</span>}
          </button>
        ))}
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground">Or upload your own image</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="block w-full text-xs mt-1"
        />
      </div>

      {bg.kind === "image" && bg.imageUrl && (
        <div className="text-[11px] text-muted-foreground">
          Custom image is set. Click Reset to remove it.
        </div>
      )}
    </Card>
  );
}
