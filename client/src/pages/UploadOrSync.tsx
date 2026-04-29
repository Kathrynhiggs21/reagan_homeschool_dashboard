import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Link as LinkIcon, FileText, RefreshCw, Mail, FolderOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AutomationFeedCard from "@/components/AutomationFeedCard";
import WeeklyDigestCard from "@/components/WeeklyDigestCard";
import { toast } from "sonner";

type RoutedResult = {
  kind: string;
  routedTo: string;
  recordId: number;
  routedToLabel: string;
  routedToHref: string;
  message: string;
};

export default function UploadOrSync() {
  const [recent, setRecent] = useState<RoutedResult[]>([]);

  // === FILE upload ===
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileNote, setFileNote] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const classifyFile = trpc.upload.classifyFile.useMutation();

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setFileBusy(true);
    try {
      const note = fileNote.trim() || undefined;
      for (const f of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        const r: RoutedResult = await classifyFile.mutateAsync({ dataUrl, fileName: f.name, note });
        setRecent((prev) => [r, ...prev].slice(0, 10));
        toast.success(r.message);
      }
      setFileNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(`Upload failed: ${e?.message ?? "try again"}`);
    } finally {
      setFileBusy(false);
    }
  };

  // === LINK ===
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const classifyLink = trpc.upload.classifyLink.useMutation();
  const submitLink = async () => {
    if (!linkUrl.trim()) return;
    try {
      const r: RoutedResult = await classifyLink.mutateAsync({
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
        note: linkNote.trim() || undefined,
      });
      setRecent((prev) => [r, ...prev].slice(0, 10));
      toast.success(r.message);
      setLinkUrl(""); setLinkTitle(""); setLinkNote("");
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message ?? "check the URL"}`);
    }
  };

  // === TEXT ===
  const [textBody, setTextBody] = useState("");
  const [textSubject, setTextSubject] = useState("");
  const [textSender, setTextSender] = useState("");
  const classifyText = trpc.upload.classifyText.useMutation();
  const submitText = async () => {
    if (!textBody.trim()) return;
    try {
      const r: RoutedResult = await classifyText.mutateAsync({
        text: textBody.trim(),
        subject: textSubject.trim() || undefined,
        sender: textSender.trim() || undefined,
      });
      setRecent((prev) => [r, ...prev].slice(0, 10));
      toast.success(r.message);
      setTextBody(""); setTextSubject(""); setTextSender("");
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message ?? "try again"}`);
    }
  };

  // === SYNC ===
  const lastSync = trpc.upload.lastSyncSummary.useQuery();
  const syncNow = trpc.upload.syncNow.useMutation({
    onSuccess: () => {
      toast.success("Sync requested — the next scheduled run picks it up within an hour.");
      lastSync.refetch();
    },
    onError: (e: any) => toast.error(`Sync failed: ${e.message}`),
  });

  return (
    <div className="container py-6 max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Upload or Sync</h1>
        <p className="text-muted-foreground">
          Add anything — file, photo, link, or note — Kiwi figures out where it goes. Gmail + Google Drive sync runs every morning at 6:30 AM.
        </p>
      </header>

      <WeeklyDigestCard />

      <AutomationFeedCard />

      {/* === SYNC AUTOMATIC === */}
      <Card className="p-5 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Auto-sync from Gmail + Google Drive</h2>
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">runs daily</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Every morning, Manus pulls new emails from Indian Hill (anything <code>@ihsd.us</code>) and your tutors,
              plus new files from your Reagan Drive folder. Each one is auto-classified into the right place.
              <br />Need it sooner? Tap <b>Sync now</b>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => syncNow.mutate({ source: "both", lookbackDays: 2 })} disabled={syncNow.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncNow.isPending ? "animate-spin" : ""}`} />
              Sync now
            </Button>
          </div>
        </div>

        {lastSync.data && (
          <div className="mt-4 p-3 rounded bg-background/40 border border-white/10 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <b>Last run:</b> {new Date(lastSync.data.startedAt as any).toLocaleString()} ·{" "}
              <span className="text-muted-foreground">{lastSync.data.source}</span> ·{" "}
              <span>{lastSync.data.itemsRouted} routed, {lastSync.data.itemsSkipped} skipped</span>
            </div>
            {lastSync.data.items?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {lastSync.data.items.slice(0, 6).map((it: any) => (
                  <li key={it.id}>
                    <span className="text-foreground">{it.title || "(untitled)"}</span> → {it.routedTo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!lastSync.data && (
          <div className="mt-4 p-3 rounded bg-background/40 border border-white/10 text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            No syncs yet — the first scheduled run will appear here once it completes.
          </div>
        )}
      </Card>

      {/* === MANUAL UPLOAD === */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* FILE */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            <h3 className="font-semibold">Upload a file</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Photo of finished work, worksheet PDF, curriculum doc — anything. Kiwi sorts it.
          </p>
          <Textarea
            placeholder="Optional note (e.g. 'math homework page 47')"
            value={fileNote}
            onChange={(e) => setFileNote(e.target.value)}
            className="text-sm"
            rows={2}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => onFilesPicked(e.target.files)}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />
          <Button className="w-full" onClick={() => fileInputRef.current?.click()} disabled={fileBusy}>
            {fileBusy ? "Uploading..." : "Pick file(s)"}
          </Button>
        </Card>

        {/* LINK */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            <h3 className="font-semibold">Paste a link</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Khan/IXL link → Apps. Book link → Bookshelf. Anything else → Parent Notes.
          </p>
          <Input placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <Input placeholder="Title (optional)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          <Textarea placeholder="Note (optional)" value={linkNote} onChange={(e) => setLinkNote(e.target.value)} rows={2} className="text-sm" />
          <Button className="w-full" onClick={submitLink} disabled={!linkUrl || classifyLink.isPending}>
            {classifyLink.isPending ? "Saving..." : "Save link"}
          </Button>
        </Card>

        {/* TEXT */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Paste text</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Tutor email, IH note, anything in writing. Tutor messages auto-route to Tutor Handoff.
          </p>
          <Input placeholder="Subject / heading (optional)" value={textSubject} onChange={(e) => setTextSubject(e.target.value)} />
          <Input placeholder="From (optional, e.g. 'Marisa Conger')" value={textSender} onChange={(e) => setTextSender(e.target.value)} />
          <Textarea placeholder="Paste the message…" value={textBody} onChange={(e) => setTextBody(e.target.value)} rows={4} />
          <Button className="w-full" onClick={submitText} disabled={!textBody || classifyText.isPending}>
            {classifyText.isPending ? "Saving..." : "Save text"}
          </Button>
        </Card>
      </div>

      {/* === RECENT === */}
      {recent.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Just saved</h3>
          <ul className="space-y-2">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm gap-3 p-2 rounded hover:bg-white/5">
                <span className="text-muted-foreground truncate flex-1">{r.message}</span>
                <a href={r.routedToHref} className="text-blue-400 hover:underline shrink-0">
                  View in {r.routedToLabel} →
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* === SOURCES INFO === */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FolderOpen className="w-5 h-5" /> What auto-sync watches
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" /> <b className="text-foreground">Gmail</b>
            </div>
            <ul className="text-xs space-y-1 ml-6 list-disc text-muted-foreground">
              <li>Anything from <code>@ihsd.us</code> (Indian Hill teachers + admin)</li>
              <li>Tutor emails (Marisa Conger / @congertutoring.com)</li>
              <li>Subject contains "homework", "tutor session", or "weekly update"</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FolderOpen className="w-4 h-4" /> <b className="text-foreground">Google Drive</b>
            </div>
            <ul className="text-xs space-y-1 ml-6 list-disc text-muted-foreground">
              <li>Files in your <b>Reagan</b> folder + <b>Reagan/IHES</b></li>
              <li>New PDFs, photos of work, curriculum docs</li>
              <li>Files modified in the last 2 days</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Sync runs automatically every morning. To change sources or schedule, head to Settings → Automations.
        </p>
      </Card>
    </div>
  );
}
