import { useMemo, useRef, useState } from "react";
import KiwiSprite from "@/components/KiwiSprite";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  WARDROBE_TABS,
  itemsForTab,
  equippedLayers,
  equippedItems,
  reactionFor,
  getItem,
  type WardrobeTab,
  type Equipped,
} from "@shared/kiwiWardrobe";
import { useKiwiWardrobe, type LookbookShot } from "@/hooks/useKiwiWardrobe";

/**
 * KiwiWardrobe — "Kiwi's Closet": a Roblox-style avatar dress-up screen.
 *
 * Layout: big Kiwi avatar on a cute stand (live preview) on the left, category
 * tabs + scrollable item grid on the right, an "equipped" strip with per-piece
 * remove, and controls (Surprise me / Take off all / Save look / Snapshot).
 * Saved looks become presets; snapshots go to the Lookbook.
 *
 * All wearables are emoji-glyph layers (see shared/kiwiWardrobe.ts) so nothing
 * needs to load and the whole thing is deterministic + editable.
 */

export function KiwiWardrobe({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const wr = useKiwiWardrobe();
  const [tab, setTab] = useState<WardrobeTab>("girly");
  const [lastReaction, setLastReaction] = useState<string>("Ooh, dress me up! Make me fabulous.");
  const [showLookbook, setShowLookbook] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const layers = useMemo(() => equippedLayers(wr.equipped), [wr.equipped]);
  const equippedList = useMemo(() => equippedItems(wr.equipped), [wr.equipped]);
  const tabItems = useMemo(() => itemsForTab(tab), [tab]);

  function handleEquip(id: string) {
    wr.equip(id);
    setLastReaction(reactionFor(id));
  }
  function handleRemoveSlot(slot: Parameters<typeof wr.removeBySlot>[0]) {
    wr.removeBySlot(slot);
    setLastReaction("Off it goes! Next look, please.");
  }
  function handleSurprise() {
    wr.surprise();
    setLastReaction("Surprise outfit! Bold choice, closet. I respect it.");
  }
  function handleTakeOff() {
    wr.takeOffAll();
    setLastReaction("Naked bird! Free and fabulous. Brrr though.");
  }
  function handleSave() {
    wr.saveLook();
    toast.success("Look saved — Kiwi will stay dressed like this!");
    setLastReaction("Saved! I'm keeping this fit. Don't touch.");
  }
  function handleSavePreset() {
    const name = window.prompt("Name this outfit (e.g. Soccer Day, Fancy, Goofy):");
    if (!name) return;
    wr.addPreset(name.trim());
    toast.success(`Preset "${name.trim()}" saved`);
  }

  /** Render the current layered avatar to a PNG dataURL via canvas (emoji draw). */
  function handleSnapshot() {
    try {
      const SIZE = 360;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
      grad.addColorStop(0, "#fff7ed");
      grad.addColorStop(1, "#fde68a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "#d8b4fe";
      ctx.beginPath();
      ctx.ellipse(SIZE / 2, SIZE * 0.82, SIZE * 0.28, SIZE * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `${Math.round(SIZE * 0.5)}px serif`;
      ctx.fillText("🦜", SIZE * 0.27, SIZE * 0.26);
      for (const g of layers) {
        ctx.save();
        const fs = SIZE * g.size;
        ctx.font = `${Math.round(fs)}px serif`;
        const x = SIZE * g.left;
        const y = SIZE * (0.2 + g.top * 0.6);
        if (g.rotate) {
          ctx.translate(x + fs / 2, y + fs / 2);
          ctx.rotate((g.rotate * Math.PI) / 180);
          ctx.fillText(g.glyph, -fs / 2, -fs / 2);
        } else {
          ctx.fillText(g.glyph, x, y);
        }
        ctx.restore();
      }
      const dataUrl = canvas.toDataURL("image/png");
      const shot: LookbookShot = {
        id: `${Date.now()}`,
        dataUrl,
        ts: Date.now(),
        name: equippedList.length ? equippedList.map((i) => i.name).join(", ") : "Classic Kiwi",
      };
      wr.addLookbookShot(shot);
      toast.success("Snapped! Added to Kiwi's Lookbook 📸");
      setLastReaction("Say cheese! ...I said CHEESE. Where's my cheese?");
    } catch {
      toast.error("Couldn't take the snapshot on this device.");
    }
  }

  function downloadShot(shot: LookbookShot) {
    const a = document.createElement("a");
    a.href = shot.dataUrl;
    a.download = `kiwi-look-${shot.id}.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] p-0 overflow-hidden border-4 border-amber-300 bg-amber-50"
        style={{ fontFamily: "'Patrick Hand','Comic Sans MS',cursive" }}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-amber-200/70">
          <DialogTitle className="text-amber-900 text-lg font-bold">🧥 Kiwi's Closet</DialogTitle>
          <button
            className="text-xs font-semibold text-amber-800 underline"
            onClick={() => setShowLookbook((v) => !v)}
            data-testid="kiwi-lookbook-toggle"
          >
            {showLookbook ? "← Back to closet" : "📸 Lookbook"}
          </button>
        </div>

        {showLookbook ? (
          <LookbookView
            shots={wr.lookbook}
            onWear={(s) => {
              setShowLookbook(false);
              toast.message(s.name);
            }}
            onDownload={downloadShot}
            onDelete={wr.deleteLookbookShot}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-0">
            {/* ---- Left: avatar stand + equipped + controls ---- */}
            <div className="p-4 bg-gradient-to-b from-amber-50 to-amber-100 border-r border-amber-200">
              <div
                ref={stageRef}
                className="relative mx-auto flex items-end justify-center"
                style={{ width: 180, height: 200 }}
                data-testid="kiwi-wardrobe-stage"
              >
                <KiwiSprite pose="idle" size={150} animate wardrobeLayers={layers} ariaLabel="Kiwi dress-up preview" />
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    width: 120,
                    height: 22,
                    background: "radial-gradient(ellipse at center, #d8b4fe 0%, #c084fc 70%, #a855f7 100%)",
                    boxShadow: "0 6px 14px rgba(168,85,247,0.4)",
                  }}
                />
              </div>

              <div className="mt-2 rounded-xl bg-white border-2 border-amber-300 px-3 py-2 text-[13px] text-slate-700 text-center min-h-[44px]">
                {lastReaction}
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-1">Wearing</div>
                {equippedList.length === 0 ? (
                  <div className="text-[12px] text-slate-400 italic">Nothing yet — pick something!</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {equippedList.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => handleRemoveSlot(it.slot)}
                        className="group flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[12px] hover:bg-rose-50"
                        title={`Remove ${it.name}`}
                        data-testid={`kiwi-equipped-${it.id}`}
                      >
                        <span aria-hidden>{it.layers[0]?.glyph}</span>
                        <span className="font-semibold text-slate-700">{it.name}</span>
                        <span className="text-rose-500 font-bold group-hover:scale-125 transition">×</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="outline" className="bg-white" onClick={handleSurprise} data-testid="kiwi-surprise">🎲 Surprise me</Button>
                <Button size="sm" variant="outline" className="bg-white" onClick={handleTakeOff} data-testid="kiwi-takeoff">🧺 Take off all</Button>
                <Button size="sm" className="bg-pink-500 hover:bg-pink-600 text-white" onClick={handleSave} data-testid="kiwi-save">✨ Save look</Button>
                <Button size="sm" variant="outline" className="bg-white" onClick={handleSnapshot} data-testid="kiwi-snapshot">📸 Snapshot</Button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Saved looks</span>
                  <button className="text-[11px] underline text-amber-700" onClick={handleSavePreset} data-testid="kiwi-add-preset">+ save current</button>
                </div>
                {wr.presets.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">No saved looks yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {wr.presets.map((p) => (
                      <span key={p.name} className="flex items-center gap-1 rounded-full bg-purple-100 border border-purple-300 px-2 py-0.5 text-[12px]">
                        <button className="font-semibold text-purple-800" onClick={() => wr.wearPreset(p.name)} title="Wear this look">{p.name}</button>
                        <button className="text-rose-500 font-bold" onClick={() => wr.deletePreset(p.name)} title="Delete preset">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ---- Right: tabs + item grid ---- */}
            <div className="p-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {WARDROBE_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold border transition ${
                      tab === t.id
                        ? "bg-amber-400 border-amber-500 text-amber-950"
                        : "bg-white border-amber-200 text-amber-800 hover:bg-amber-100"
                    }`}
                    data-testid={`kiwi-tab-${t.id}`}
                  >
                    <span aria-hidden className="mr-0.5">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <ScrollArea className="h-[320px] pr-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {tabItems.map((it) => {
                    const isOn = Object.values(wr.equipped).includes(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleEquip(it.id)}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 transition hover:-translate-y-0.5 ${
                          isOn ? "border-pink-400 bg-pink-50" : "border-amber-200 bg-white hover:border-amber-300"
                        }`}
                        title={it.reaction}
                        data-testid={`kiwi-item-${it.id}`}
                      >
                        <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{it.layers[0]?.glyph}</span>
                        <span className="text-[11px] text-center text-slate-700 leading-tight">{it.name}</span>
                        {it.isSet && <span className="text-[9px] text-purple-600 font-bold uppercase">set</span>}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="mt-2 text-[11px] text-amber-700/80">
                Tip: one item per spot — a new hat swaps the old one. Tap a “Wearing” chip’s × to take just that piece off. Costume <b>sets</b> can be worn whole or piece-by-piece.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LookbookView({
  shots,
  onWear,
  onDownload,
  onDelete,
}: {
  shots: LookbookShot[];
  onWear: (s: LookbookShot) => void;
  onDownload: (s: LookbookShot) => void;
  onDelete: (id: string) => void;
}) {
  if (shots.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="text-4xl mb-2">📸</div>
        <p className="text-sm">No snapshots yet! Dress Kiwi up and tap <b>Snapshot</b> to start her Lookbook.</p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-[420px] p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {shots.map((s) => (
          <div key={s.id} className="rounded-xl border-2 border-amber-200 bg-white overflow-hidden" data-testid={`lookbook-shot-${s.id}`}>
            <img src={s.dataUrl} alt={s.name} className="w-full aspect-square object-cover" />
            <div className="p-1.5">
              <div className="text-[11px] font-semibold text-slate-700 truncate" title={s.name}>{s.name}</div>
              <div className="text-[10px] text-slate-400">{new Date(s.ts).toLocaleDateString()}</div>
              <div className="flex gap-1 mt-1">
                <button className="text-[11px] underline text-amber-700" onClick={() => onWear(s)}>view</button>
                <button className="text-[11px] underline text-amber-700" onClick={() => onDownload(s)}>save</button>
                <button className="text-[11px] underline text-rose-600 ml-auto" onClick={() => onDelete(s.id)}>delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default KiwiWardrobe;

/** Read the persisted outfit layers for use on the live perch (outside the dialog). */
export function readPersistedWardrobeLayers(): ReturnType<typeof equippedLayers> {
  try {
    const raw = localStorage.getItem("kiwi_outfit_v1");
    const eq = raw ? (JSON.parse(raw) as Equipped) : {};
    return equippedLayers(eq);
  } catch {
    return [];
  }
}
