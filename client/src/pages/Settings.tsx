import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWhisper } from "@/contexts/WhisperContext";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const ctx = useWhisper();
  const [name, setName] = useState(ctx.companionName);
  const recipients = trpc.recipients.list.useQuery();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Settings ⚙️</h1>
        <p className="text-muted-foreground text-sm mt-1">Customize Reagan's experience.</p>
      </header>

      <Card className="cozy-card p-5 space-y-4">
        <div className="font-display font-semibold">Your Companion</div>
        <div>
          <label className="text-sm font-medium">Companion name</label>
          <div className="flex gap-2 mt-1">
            <Input value={name} onChange={e => setName(e.target.value)} />
            <Button onClick={() => { ctx.setCompanionName(name); toast.success(`Now I'm ${name}!`); }}>Save</Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Avatar</label>
          <div className="flex gap-2 mt-1">
            {["🪶", "🦜", "🦆", "🐉", "🌙", "✨"].map(e => (
              <button key={e} onClick={() => ctx.setCompanionAvatar(e)} className={`text-2xl p-2 rounded-xl border ${ctx.companionAvatar === e ? "bg-primary/20 border-primary" : "bg-card"}`}>{e}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Adult present mode</div>
            <div className="text-xs text-muted-foreground">Pauses Whisper when adult is helping</div>
          </div>
          <Switch checked={ctx.adultPresent} onCheckedChange={ctx.setAdultPresent} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Voice mode</div>
            <div className="text-xs text-muted-foreground">Whisper can speak aloud</div>
          </div>
          <Switch checked={ctx.voiceMode === "voice"} onCheckedChange={(b) => ctx.setVoiceMode(b ? "voice" : "text")} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Listening mode</div>
          <div className="flex gap-2 flex-wrap">
            {[["wake","Wake word"],["tap","Tap to talk"],["always","Always on"],["off","Off"]].map(([m,label]) => (
              <button key={m} onClick={() => ctx.setMode(m as any)} className={`text-xs px-3 py-1.5 rounded-full border ${ctx.mode === m ? "bg-primary text-primary-foreground" : "bg-card"}`}>{label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="cozy-card p-5">
        <div className="font-display font-semibold mb-3">Notification Recipients</div>
        <div className="space-y-2">
          {(recipients.data ?? []).map((r: any) => (
            <div key={r.id} className="text-sm flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email} · {r.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
