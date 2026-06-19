import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getTheme } from "@shared/interestEngine";

/**
 * InterestsCard — "What Reagan keeps coming back to."
 *
 * Real, frequency-weighted interest profile built from Reagan's own
 * YouTube signals (Liked videos + Subscriptions + Playlists via the
 * Data API) and/or an imported Google Takeout watch-history.json. The
 * topic she returns to most rises to the top. These interests quietly
 * drift her activity ideas, assignment themes, Kiwi's chatter, and
 * unlock interest-themed Kiwi wearables.
 *
 * Honest about the limits: live likes/subs need a connected YouTube
 * account (OAuth). Watch history is ONLY available via Takeout. With
 * neither connected, the profile stays empty — nothing is invented.
 */
export default function InterestsCard() {
  const utils = trpc.useUtils();
  const profileQ = (trpc as any).interests?.profile?.useQuery?.(undefined, {
    staleTime: 60_000,
  });
  const data = profileQ?.data;
  const profile: Array<{ topic: string; label: string; weight: number; hits: number; samples: string[] }> =
    data?.profile ?? [];

  const [manual, setManual] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const syncM = (trpc as any).interests?.syncYouTube?.useMutation?.({
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Synced ${r.signals} YouTube signals → ${r.topicsTouched} interests`);
      else toast.message("YouTube isn't connected yet", { description: "Connect the account Reagan uses to enable live sync." });
      utils.interests?.profile?.invalidate?.();
    },
    onError: (e: any) => toast.error(e?.message || "Sync failed"),
  });

  const importM = (trpc as any).interests?.importTakeout?.useMutation?.({
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Imported ${r.signals} watched videos → ${r.topicsTouched} interests`);
      else toast.message("No usable rows", { description: "That file didn't look like a watch-history.json export." });
      utils.interests?.profile?.invalidate?.();
    },
    onError: (e: any) => toast.error(e?.message || "Import failed"),
    onSettled: () => setImporting(false),
  });

  const manualM = (trpc as any).interests?.addManual?.useMutation?.({
    onSuccess: (r: any) => {
      if (r?.ok) { toast.success(`Added: ${r.matched?.join(", ")}`); setManual(""); }
      else toast.message("Didn't match a known theme", { description: "Try a clearer keyword like \"birds\", \"art\", or \"minecraft\"." });
      utils.interests?.profile?.invalidate?.();
    },
    onError: (e: any) => toast.error(e?.message || "Couldn't add"),
  });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) {
        toast.error("That file isn't a watch-history.json array.");
        setImporting(false);
        return;
      }
      const rows = json.slice(-50000);
      importM?.mutate?.({ rows });
    } catch {
      toast.error("Couldn't read that file as JSON.");
      setImporting(false);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const connected = !!data?.connected;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : null;
  const maxWeight = profile.reduce((m, p) => Math.max(m, p.weight), 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>🌟</span> What Reagan’s Into
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The things she keeps coming back to — learned from her own YouTube likes,
          channels she follows, and (optionally) her watch history. These quietly shape
          her activity ideas, assignment themes, and what Kiwi chats about.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Connection status */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium">YouTube:</span>
          {connected ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300">Not connected</Badge>
          )}
          {lastSyncAt && (
            <span className="text-muted-foreground">
              · last sync {lastSyncAt}{data?.lastSource ? ` (${data.lastSource})` : ""}
            </span>
          )}
        </div>

        {!connected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
            To pull her <strong>Likes + Subscriptions</strong> automatically, the account Reagan
            uses needs to be connected with YouTube read access. Until then you can still build her
            profile by <strong>importing a Google Takeout watch-history file</strong> below, or adding
            interests by hand. Nothing is ever made up — this stays empty until real data comes in.
          </div>
        )}
        {data?.lastError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            Last sync note: {data.lastError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => syncM?.mutate?.()}
            disabled={syncM?.isPending}
          >
            {syncM?.isPending ? "Syncing…" : "Sync YouTube now"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-background"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Importing…" : "Import Takeout history…"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        {/* Manual add */}
        <div className="flex gap-2">
          <Input
            placeholder="Add an interest by hand (e.g. birds, art, minecraft)"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual.trim().length >= 2) manualM?.mutate?.({ text: manual.trim() });
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => manual.trim().length >= 2 && manualM?.mutate?.({ text: manual.trim() })}
            disabled={manualM?.isPending || manual.trim().length < 2}
          >
            Add
          </Button>
        </div>

        {/* Ranked profile */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Her top interests</h4>
          {profileQ?.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : profile.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Sync YouTube, import a Takeout file, or add one by hand to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {profile.map((p) => {
                const theme = getTheme(p.topic);
                const pct = Math.round((p.weight / maxWeight) * 100);
                return (
                  <li key={p.topic} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        <span aria-hidden>{theme?.emoji ?? "•"}</span>
                        {p.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        seen {p.hits}× · score {p.weight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {p.samples.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                        {p.samples.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
