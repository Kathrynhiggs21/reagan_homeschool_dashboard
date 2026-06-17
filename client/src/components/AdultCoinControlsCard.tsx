import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Coins, Camera, Upload, X, Check } from "lucide-react";

/**
 * AdultCoinControlsCard
 * Two adult-only coin tools, both positive-only (we never punish):
 *   1) +Coins — Mom/Grandma grant coins anytime with a reason, amount, and an
 *      optional camera photo OR file upload as proof.
 *   2) End-of-day bonus — concentration + attitude (0..3 each) → up to +6 coins.
 *
 * Server: submissions.grantCoins, submissions.setDayBonus, submissions.upload.
 */

const RATING_LABELS = ["—", "Okay", "Good", "Great"];

function AmountChip({ v, set }: { v: number; set: (n: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(v)}
      className="rounded-full border px-3 py-1 text-sm font-semibold hover:bg-amber-50"
    >
      +{v}
    </button>
  );
}

export default function AdultCoinControlsCard() {
  const utils = trpc.useUtils();

  // ---- manual grant state ----
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState("");
  const [grantedBy, setGrantedBy] = useState("");
  const [photo, setPhoto] = useState<string | null>(null); // dataUrl preview
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const upload = trpc.submissions.upload.useMutation();
  const grant = trpc.submissions.grantCoins.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Gave Reagan ${r?.awarded ?? amount} coins 🪙`);
      setReason(""); setAmount(5); setPhoto(null); setPhotoName(null);
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message || "Couldn't grant coins"),
  });

  // ---- camera ----
  async function openCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
      // attach after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      toast.error("Couldn't open the camera. You can upload a photo instead.");
    }
  }
  function closeCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }
  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 720;
    canvas.height = v.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);
    setPhotoName(`grant-photo-${Date.now()}.jpg`);
    closeCam();
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Please choose a file under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoName(f.name);
    };
    reader.readAsDataURL(f);
  }

  async function submitGrant() {
    if (!reason.trim()) { toast.error("Add a quick reason."); return; }
    if (amount < 1) { toast.error("Amount must be at least 1."); return; }
    let attachmentUrl: string | undefined;
    try {
      if (photo && photoName) {
        const up = await upload.mutateAsync({ dataUrl: photo, fileName: photoName });
        attachmentUrl = (up as any)?.url ?? undefined;
      }
    } catch {
      toast.error("Photo upload failed — granting coins without the photo.");
    }
    grant.mutate({
      amount,
      reason: reason.trim(),
      attachmentUrl,
      grantedByName: grantedBy.trim() || undefined,
    });
  }

  // ---- end-of-day bonus ----
  const [concentration, setConcentration] = useState(0);
  const [attitude, setAttitude] = useState(0);
  const dayBonus = trpc.submissions.setDayBonus.useMutation({
    onSuccess: (r: any) => {
      toast.success(r?.awarded > 0 ? `Added ${r.awarded} bonus coins 🪙` : "Saved.");
      utils.invalidate();
    },
    onError: (e) => toast.error(e.message || "Couldn't save bonus"),
  });

  return (
    <Card className="p-4 rounded-2xl space-y-5">
      <div>
        <div className="font-semibold text-base mb-1 flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" /> Give coins (adult)
        </div>
        <div className="text-xs opacity-70">
          Mom or Grandma can hand out coins anytime — chores, kindness, anything Reagan
          does. Add a reason and, if you like, snap a photo as proof.
        </div>
      </div>

      {/* ---- Manual +Coins ---- */}
      <div className="rounded-xl border p-3 space-y-3 bg-amber-50/40">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-1 pb-1">
            {[1, 3, 5, 10, 25].map((v) => (
              <AmountChip key={v} v={v} set={setAmount} />
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Reason (Reagan will see this)</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Helped fold laundry without being asked"
            maxLength={120}
          />
        </div>

        <div>
          <Label className="text-xs">From (optional)</Label>
          <Input
            value={grantedBy}
            onChange={(e) => setGrantedBy(e.target.value)}
            placeholder="Mom / Grandma"
            maxLength={40}
            className="w-48"
          />
        </div>

        {/* photo / upload */}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openCam}>
            <Camera className="h-4 w-4 mr-1" /> Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" /> Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onPickFile}
          />
          {photo && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border rounded-full pl-2 pr-1 py-0.5">
              <Check className="h-3 w-3 text-teal-600" />
              {photoName?.slice(0, 22) || "attached"}
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoName(null); }}
                className="rounded-full hover:bg-muted p-0.5"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {camOpen && (
          <div className="rounded-lg overflow-hidden border bg-black">
            <video ref={videoRef} playsInline muted className="w-full max-h-72 object-contain" />
            <div className="flex gap-2 p-2 bg-background">
              <Button size="sm" onClick={snap}>
                <Camera className="h-4 w-4 mr-1" /> Capture
              </Button>
              <Button size="sm" variant="ghost" onClick={closeCam}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Button
          onClick={submitGrant}
          disabled={grant.isPending || upload.isPending}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          {grant.isPending || upload.isPending ? "Giving…" : `Give ${amount} coins`}
        </Button>
      </div>

      {/* ---- End-of-day bonus ---- */}
      <div className="rounded-xl border p-3 space-y-3">
        <div className="font-semibold text-sm">End-of-day bonus</div>
        <div className="text-xs opacity-70 -mt-1">
          Reward focus and a good attitude. Each adds up to +3 coins (max +6/day). This only
          ever adds coins — it never takes any away.
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">Concentration</Label>
            <span className="text-[11px] text-muted-foreground">{RATING_LABELS[concentration]}</span>
          </div>
          <Slider value={[concentration]} min={0} max={3} step={1} onValueChange={(v) => setConcentration(v[0] ?? 0)} />
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">Attitude</Label>
            <span className="text-[11px] text-muted-foreground">{RATING_LABELS[attitude]}</span>
          </div>
          <Slider value={[attitude]} min={0} max={3} step={1} onValueChange={(v) => setAttitude(v[0] ?? 0)} />
        </div>

        <Button
          variant="outline"
          onClick={() => dayBonus.mutate({ concentration, attitude })}
          disabled={dayBonus.isPending}
        >
          {dayBonus.isPending ? "Saving…" : `Give today's bonus (+${concentration + attitude})`}
        </Button>
      </div>
    </Card>
  );
}
