import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useKiwi } from "@/contexts/KiwiContext";

export default function AvatarUploader() {
  const { photoUrl, setPhotoUrl } = useKiwi() as unknown as {
    photoUrl: string | null;
    setPhotoUrl: (url: string | null) => void;
  };
  const upload = trpc.submissions.upload.useMutation();
  const persistProfile = trpc.profile.update.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function persist(url: string | null) {
    setPhotoUrl(url);
    try {
      await persistProfile.mutateAsync({ photoUrl: url ?? "" } as any);
      setSavedAt(new Date());
    } catch (e: any) {
      // Non-fatal — local copy still set.
      console.warn("[avatar] profile.update failed", e?.message);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Photo is too large (max 8MB).");
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsDataURL(file);
      });
      const result = await upload.mutateAsync({ dataUrl, fileName: `avatar-${Date.now()}-${file.name}` });
      await persist(result.url);
    } catch (e: any) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chalkboard !p-4 !rounded-xl space-y-3">
      <div className="font-display text-xl chalk-yellow">Reagan's Photo</div>
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="Reagan" className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: "#f7f1e3" }} />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-display border-2" style={{ background: "#faf6ec", color: "#1a1a1a", borderColor: "#f7f1e3" }}>R</div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="px-4 py-2 rounded-md font-semibold"
            style={{ background: "#ffd967", color: "#1a1a1a" }}
          >
            {busy ? "Uploading…" : photoUrl ? "Replace photo" : "Choose a photo"}
          </button>
          {photoUrl && (
            <button
              type="button"
              onClick={() => void persist(null)}
              className="text-xs underline chalk-white/70 text-left"
            >
              Remove
            </button>
          )}
          {savedAt && (
            <div className="text-[10px] chalk-white/50">Saved at {savedAt.toLocaleTimeString()}</div>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      {err && <div className="text-xs" style={{ color: "#ff9a9a" }}>{err}</div>}
      <div className="text-xs chalk-white/60">
        Photo stays private to your dashboard. Upload a clear square headshot for best results.
      </div>
    </div>
  );
}
