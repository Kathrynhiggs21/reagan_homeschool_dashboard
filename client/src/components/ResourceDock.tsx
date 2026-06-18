import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FloatingWindow from "@/components/FloatingWindow";
import KidNotebookPopup from "@/components/KidNotebookPopup";

/**
 * ResourceDock — tiny floating dock (bottom-center) with the quick tools
 * Reagan can pop open while doing a block: Notebook, Timer, Calculator,
 * Word Finder.
 *
 * 2026-06-18 (Katy): these tools are now DRAGGABLE FLOATING WINDOWS, not
 * blocking modals. Each one can be moved around by its title bar, minimized,
 * and — critically — stays open while Reagan navigates the rest of the site
 * (the dock owns the open/closed flags, and the dock is mounted globally in
 * App.tsx outside the route switch). More than one tool can be open at once
 * (e.g. Calculator + Word at the same time).
 *
 * The Notebook lives here in the dock "extras"; Kiwi can also open it by
 * dispatching the `kiwi:open-notebook` window event. The Timer lives ONLY
 * here in the dock (never inline on her pages); time-on-task is still recorded
 * silently for analytics elsewhere regardless of whether she opens this timer.
 */

export default function ResourceDock() {
  // Each tool tracks its own open flag so multiple can float at once and each
  // stays open across navigation.
  const [timerOpen, setTimerOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);

  // Let Kiwi (or anything else) open the notebook via a window event.
  useEffect(() => {
    const onOpen = () => setNotebookOpen(true);
    window.addEventListener("kiwi:open-notebook", onOpen as EventListener);
    return () => window.removeEventListener("kiwi:open-notebook", onOpen as EventListener);
  }, []);

  return (
    <>
      <div
        data-testid="resource-dock"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-row gap-1.5 px-2.5 py-1.5 rounded-2xl bg-background/90 backdrop-blur border-2 border-amber-200/70 shadow-xl no-print"
        style={{ pointerEvents: "auto" }}
      >
        <DockBtn onClick={() => setNotebookOpen(true)} active={notebookOpen} label="Notebook" emoji="📝" />
        <DockBtn onClick={() => setTimerOpen((v) => !v)} active={timerOpen} label="Timer" emoji="⏱️" />
        <DockBtn onClick={() => setCalcOpen((v) => !v)} active={calcOpen} label="Calc" emoji="🧮" />
        <DockBtn onClick={() => setDictOpen((v) => !v)} active={dictOpen} label="Word" emoji="📖" />
      </div>

      <KidNotebookPopup open={notebookOpen} onClose={() => setNotebookOpen(false)} />

      <FloatingWindow open={timerOpen} title="Timer" emoji="⏱️" width={340} height={300} minHeight={240} testId="floating-timer" onClose={() => setTimerOpen(false)}>
        <TimerBody />
      </FloatingWindow>

      <FloatingWindow open={calcOpen} title="Calculator" emoji="🧮" width={320} height={420} minHeight={320} testId="floating-calc" onClose={() => setCalcOpen(false)}>
        <CalcBody />
      </FloatingWindow>

      <FloatingWindow open={dictOpen} title="Word Finder" emoji="📖" width={380} height={400} minHeight={260} testId="floating-dict" onClose={() => setDictOpen(false)}>
        <DictBody />
      </FloatingWindow>
    </>
  );
}

function DockBtn({ onClick, label, emoji, active }: { onClick: () => void; label: string; emoji: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl border hover:bg-amber-50 hover:border-amber-300 hover:scale-105 transition select-none ${active ? "bg-amber-100 border-amber-400 dark:bg-amber-900/40" : "bg-background"}`}
      title={label}
      aria-label={label}
    >
      <span className="text-lg leading-none">{emoji}</span>
      <span className="text-[10px] font-semibold text-muted-foreground leading-none">{label}</span>
    </button>
  );
}

/* ------- Timer ------- */
function TimerBody() {
  const [presets] = useState([60, 300, 600, 900, 1500]);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const ivRef = useRef<any>(null);

  useEffect(() => {
    if (running && secs > 0) {
      ivRef.current = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    } else {
      if (ivRef.current) clearInterval(ivRef.current);
      if (secs === 0 && running) setRunning(false);
    }
    return () => ivRef.current && clearInterval(ivRef.current);
  }, [running, secs]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="text-center space-y-4 py-3">
      <div className="text-6xl font-bold tabular-nums">{fmt(secs)}</div>
      <div className="flex gap-2 flex-wrap justify-center">
        {presets.map((p) => (
          <Button
            key={p}
            variant="secondary"
            onClick={() => { setSecs(p); setRunning(false); }}
            className="rounded-full"
          >
            {p < 60 ? `${p}s` : `${p / 60}m`}
          </Button>
        ))}
      </div>
      <div className="flex gap-2 justify-center">
        <Button onClick={() => setRunning((r) => !r)} disabled={secs === 0}>
          {running ? "Pause" : "Start"}
        </Button>
        <Button variant="outline" onClick={() => { setRunning(false); setSecs(0); }}>
          Reset
        </Button>
      </div>
    </div>
  );
}

/* ------- Calculator ------- */
function CalcBody() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string>("");
  const evalExpr = () => {
    try {
      // Simple safe math eval — only digits and math operators
      if (!/^[-+*/().\d\s]+$/.test(expr)) {
        setResult("only numbers please");
        return;
      }
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${expr})`)();
      setResult(String(v));
    } catch {
      setResult("hmm, try again");
    }
  };
  const tap = (c: string) => {
    if (c === "C") { setExpr(""); setResult(""); return; }
    if (c === "=") { evalExpr(); return; }
    if (c === "⌫") { setExpr((e) => e.slice(0, -1)); return; }
    setExpr((e) => e + c);
  };
  const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted p-3 text-right">
        <div className="text-sm opacity-70 min-h-[1em] break-all">{expr || "0"}</div>
        <div className="text-3xl font-bold tabular-nums">{result || "—"}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => (
          <Button key={k} variant="secondary" onClick={() => tap(k)} className="h-12 text-lg">
            {k}
          </Button>
        ))}
        <Button variant="outline" onClick={() => tap("⌫")} className="h-12 text-lg">⌫</Button>
        <Button variant="outline" onClick={() => tap("C")} className="h-12 text-lg">C</Button>
        <Button variant="outline" onClick={() => tap("(")} className="h-12 text-lg">(</Button>
        <Button variant="outline" onClick={() => tap(")")} className="h-12 text-lg">)</Button>
      </div>
    </div>
  );
}

/* ------- Dictionary ------- */
function DictBody() {
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const look = async (w?: string) => {
    const q = (w ?? word).trim();
    if (!q) return;
    setLoading(true); setErr(null); setEntries(null);
    try {
      const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`);
      if (!r.ok) { setErr("Couldn't find that word."); setLoading(false); return; }
      const data = await r.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setErr("No internet right now.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Look up a word…"
          onKeyDown={(e) => e.key === "Enter" && look()}
        />
        <Button onClick={() => look()} disabled={!word.trim() || loading}>Look</Button>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Looking it up…</div>}
      {err && <div className="text-sm text-rose-500">{err}</div>}
      {entries && entries.length === 0 && !err && (
        <div className="text-sm text-muted-foreground">No entries.</div>
      )}
      {entries && entries.slice(0, 2).map((e: any, i: number) => (
        <div key={i} className="rounded-xl border p-3 text-sm space-y-2">
          <div className="font-display text-xl font-semibold">{e.word}</div>
          {e.phonetic && <div className="text-xs text-muted-foreground">{e.phonetic}</div>}
          {e.meanings?.slice(0, 2).map((m: any, j: number) => (
            <div key={j}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.partOfSpeech}</div>
              <ol className="list-decimal ml-5 space-y-1">
                {m.definitions.slice(0, 2).map((d: any, k: number) => (
                  <li key={k}>
                    <div>{d.definition}</div>
                    {d.example && <div className="text-xs text-muted-foreground">e.g., "{d.example}"</div>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
