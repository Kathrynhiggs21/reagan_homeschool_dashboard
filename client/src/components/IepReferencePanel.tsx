/**
 * Adult-only IEP reference panel — codified Color-Coded Warning Zones,
 * Crisis Decision Tree, and What Works/What Doesn't matrix from the
 * canonical docs in /Reagan Health/.
 *
 * Lives on the Settings page (already adult-gated). Three collapsible
 * cards so Mom and Grandma can scan or expand any section without
 * a wall-of-text.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, ListChecks } from "lucide-react";

const ZONE_TINTS: Record<string, string> = {
  green: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-900/40 dark:text-green-100",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/30 dark:border-yellow-900/40 dark:text-yellow-100",
  red: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-100",
  black: "bg-zinc-100 border-zinc-300 text-zinc-900 dark:bg-zinc-900/60 dark:border-zinc-700 dark:text-zinc-100",
};

function ExpandableCard({ icon, title, defaultOpen, children }: { icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card className="border-border/60">
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <CardTitle className="flex items-center gap-2 text-base">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0 space-y-4 text-sm">{children}</CardContent>}
    </Card>
  );
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="text-xs text-muted-foreground italic px-1 py-2">Loading {label}…</div>
  );
}
function PanelError({ label, msg }: { label: string; msg: string }) {
  return (
    <div className="text-xs text-red-600 dark:text-red-400 px-1 py-2">
      Couldn’t load {label}: {msg}
    </div>
  );
}
function PanelEmpty({ label }: { label: string }) {
  return (
    <div className="text-xs text-muted-foreground italic px-1 py-2">No {label} configured yet.</div>
  );
}

export function WarningZonesCard() {
  const zones = trpc.iep.warningZones.useQuery();
  if (zones.isLoading) {
    return (
      <ExpandableCard icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Color-Coded Warning Zones">
        <PanelLoading label="warning zones" />
      </ExpandableCard>
    );
  }
  if (zones.error) {
    return (
      <ExpandableCard icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Color-Coded Warning Zones">
        <PanelError label="warning zones" msg={zones.error.message} />
      </ExpandableCard>
    );
  }
  if (!zones.data || zones.data.length === 0) {
    return (
      <ExpandableCard icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Color-Coded Warning Zones">
        <PanelEmpty label="warning zones" />
      </ExpandableCard>
    );
  }
  return (
    <ExpandableCard icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Color-Coded Warning Zones">
      <div className="text-xs text-muted-foreground -mt-2 mb-2">
        Codified from Reagan&apos;s IEP-aligned Color-Coded Warning Zones &amp; Intervention Guide. Match what you see → use the response → avoid the don&apos;ts.
      </div>
      {zones.data.map((z: any) => (
        <div key={z.zone} className={`border rounded-lg p-3 ${ZONE_TINTS[z.zone] ?? ""}`}>
          <div className="font-semibold mb-1">{z.label}</div>
          <div className="text-xs italic mb-2">
            Anxiety {z.internalState.anxietyMin}–{z.internalState.anxietyMax}/10 · {z.internalState.description}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="font-semibold mb-1">What you&apos;ll see</div>
              <ul className="list-disc list-inside space-y-0.5">
                {z.observableSignals.slice(0, 5).map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-1">Your response</div>
              <ul className="list-disc list-inside space-y-0.5">
                {z.response.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-1">DO NOT</div>
              <ul className="list-disc list-inside space-y-0.5">
                {z.avoid.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </ExpandableCard>
  );
}

export function CrisisProtocolCard() {
  const protocol = trpc.iep.crisisProtocol.useQuery();
  if (protocol.isLoading) {
    return (
      <ExpandableCard icon={<ShieldCheck className="w-4 h-4 text-red-600" />} title="Crisis Decision Tree (3 steps)">
        <PanelLoading label="crisis protocol" />
      </ExpandableCard>
    );
  }
  if (protocol.error) {
    return (
      <ExpandableCard icon={<ShieldCheck className="w-4 h-4 text-red-600" />} title="Crisis Decision Tree (3 steps)">
        <PanelError label="crisis protocol" msg={protocol.error.message} />
      </ExpandableCard>
    );
  }
  if (!protocol.data || protocol.data.length === 0) {
    return (
      <ExpandableCard icon={<ShieldCheck className="w-4 h-4 text-red-600" />} title="Crisis Decision Tree (3 steps)">
        <PanelEmpty label="crisis protocol" />
      </ExpandableCard>
    );
  }
  return (
    <ExpandableCard icon={<ShieldCheck className="w-4 h-4 text-red-600" />} title="Crisis Decision Tree (3 steps)">
      <div className="text-xs text-muted-foreground -mt-2 mb-2">
        Codified from Reagan&apos;s Contact Protocol &amp; Crisis Response Decision Tree. Use this in Red Zone or Black Zone.
      </div>
      <ol className="space-y-3">
        {protocol.data.map((step: any) => (
          <li key={step.step} className="border-l-4 border-red-500 pl-3">
            <div className="font-semibold">
              Step {step.step}: {step.label}
              <span className="text-xs text-muted-foreground ml-2">
                ({step.windowSeconds.min}–{step.windowSeconds.max}s)
              </span>
            </div>
            <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
              {step.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </ExpandableCard>
  );
}

export function WhatWorksMatrixCard() {
  const matrix = trpc.iep.whatWorksMatrix.useQuery();
  if (matrix.isLoading) {
    return (
      <ExpandableCard icon={<ListChecks className="w-4 h-4 text-emerald-600" />} title="What Works vs What Doesn't (quick matrix)">
        <PanelLoading label="what-works matrix" />
      </ExpandableCard>
    );
  }
  if (matrix.error) {
    return (
      <ExpandableCard icon={<ListChecks className="w-4 h-4 text-emerald-600" />} title="What Works vs What Doesn't (quick matrix)">
        <PanelError label="what-works matrix" msg={matrix.error.message} />
      </ExpandableCard>
    );
  }
  if (!matrix.data || matrix.data.length === 0) {
    return (
      <ExpandableCard icon={<ListChecks className="w-4 h-4 text-emerald-600" />} title="What Works vs What Doesn't (quick matrix)">
        <PanelEmpty label="what-works matrix" />
      </ExpandableCard>
    );
  }
  return (
    <ExpandableCard icon={<ListChecks className="w-4 h-4 text-emerald-600" />} title="What Works vs What Doesn't (quick matrix)">
      <div className="text-xs text-muted-foreground -mt-2 mb-2">
        Codified from Reagan&apos;s IEP-aligned Master Guide. The AI Agenda Editor uses these same rules whenever you ask it to soften the day.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-semibold">Situation</th>
              <th className="text-left p-2 font-semibold text-red-700 dark:text-red-400">Doesn&apos;t Work</th>
              <th className="text-left p-2 font-semibold text-emerald-700 dark:text-emerald-400">Works</th>
            </tr>
          </thead>
          <tbody>
            {matrix.data.map((r: any) => (
              <tr key={r.situation} className="border-b last:border-b-0 align-top">
                <td className="p-2 font-medium">{r.label}</td>
                <td className="p-2">{r.doesNotWork.join("; ")}</td>
                <td className="p-2">{r.doesWork.join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExpandableCard>
  );
}

export default function IepReferencePanel() {
  return (
    <div className="space-y-3">
      <WarningZonesCard />
      <CrisisProtocolCard />
      <WhatWorksMatrixCard />
    </div>
  );
}
