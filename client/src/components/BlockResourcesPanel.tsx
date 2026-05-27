/**
 * BlockResourcesPanel — v2.97 (2026-05-27)
 *
 * Adult-side AgendaEditor sub-panel for managing the materials/links/printables
 * attached to a curriculum topic. Available to Mom, Grandma, and tutors
 * (familyAdminProcedure already accepts all three).
 *
 * v2.97 adds 4 attach modes via tabs:
 *   - Link    : paste a URL (original behavior)
 *   - Upload  : pick a PDF or image from device → S3 → curriculumResources
 *   - Camera  : capture a worksheet with the device camera (mobile or laptop)
 *   - Custom  : create-your-own lesson — title + description, no URL
 *
 * Wiring:
 *   topicCode (e.g. "M.5.A.1")
 *     ↓ trpc.curriculum.topicByCode  → topicId (number)
 *     ↓ trpc.curriculum.rollup        → { resources, blocks }
 *     ↑ trpc.curriculum.addResource          ← Link tab submit
 *     ↑ trpc.curriculum.uploadResourceFile   ← Upload + Camera tabs submit
 *     ↑ trpc.curriculum.createCustomResource ← Custom tab submit
 *     ↑ trpc.curriculum.removeResource       ← per-row remove button
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const KIND_OPTIONS = ["worksheet", "video", "lesson", "reading", "printable", "link"] as const;
type Kind = (typeof KIND_OPTIONS)[number];

const KIND_BADGE: Record<Kind, string> = {
  worksheet: "📝",
  video: "🎬",
  lesson: "📘",
  reading: "📖",
  printable: "🖨️",
  link: "🔗",
};

type Tab = "link" | "upload" | "camera" | "custom";

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const out = reader.result as string;
      // strip "data:<mime>;base64," prefix
      const comma = out.indexOf(",");
      resolve(comma >= 0 ? out.slice(comma + 1) : out);
    };
    reader.readAsDataURL(file);
  });
}

export function BlockResourcesPanel({ topicCode }: { topicCode: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("link");
  const [kind, setKind] = useState<Kind>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [cameraBlob, setCameraBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const utils = trpc.useUtils();

  // Resolve topic code → numeric id.
  const topicByCode = trpc.curriculum.topicByCode.useQuery(
    { code: topicCode ?? "" },
    { enabled: !!topicCode },
  );
  const topicId = (topicByCode.data as any)?.id as number | undefined;

  // Pull the live rollup so we can render the existing list AND invalidate it.
  const rollup = trpc.curriculum.rollup.useQuery(
    { topicId: topicId ?? 0 },
    { enabled: typeof topicId === "number" && topicId > 0 },
  );
  const resources: Array<{ id: number; kind: string; title: string; url: string | null }> =
    (rollup.data?.resources ?? []) as any[];

  const resetCommon = () => {
    setTitle("");
    setUrl("");
    setCustomDescription("");
    setUploadFile(null);
    setCameraPreviewUrl(null);
    setCameraBlob(null);
  };

  const refreshList = async () => {
    if (typeof topicId === "number") {
      await utils.curriculum.rollup.invalidate({ topicId });
    }
  };

  const addResource = trpc.curriculum.addResource.useMutation({
    onSuccess: async () => {
      resetCommon();
      await refreshList();
      toast.success("Resource added");
    },
    onError: (err) => toast.error(err.message || "Could not add resource"),
  });

  const uploadResource = trpc.curriculum.uploadResourceFile.useMutation({
    onSuccess: async () => {
      resetCommon();
      await refreshList();
      toast.success("File uploaded");
    },
    onError: (err) => toast.error(err.message || "Could not upload file"),
  });

  const createCustom = trpc.curriculum.createCustomResource.useMutation({
    onSuccess: async () => {
      resetCommon();
      await refreshList();
      toast.success("Custom lesson added");
    },
    onError: (err) => toast.error(err.message || "Could not save lesson"),
  });

  const removeResource = trpc.curriculum.removeResource.useMutation({
    onSuccess: async () => {
      await refreshList();
      toast.success("Resource removed");
    },
    onError: (err) => toast.error(err.message || "Could not remove resource"),
  });

  // Camera lifecycle: start when tab=camera + cameraOn, stop otherwise.
  useEffect(() => {
    let alive = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        toast.error(err?.message || "Could not start camera");
        setCameraOn(false);
      }
    }
    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    if (tab === "camera" && cameraOn) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      alive = false;
      stopCamera();
    };
  }, [tab, cameraOn]);

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) return;
      setCameraBlob(blob);
      setCameraPreviewUrl(URL.createObjectURL(blob));
      // Stop the stream after capture for privacy + battery.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraOn(false);
    }, "image/jpeg", 0.9);
  };

  // Render nothing when there's no topic to anchor to.
  if (!topicCode) return null;

  const count = resources.length;

  const linkDisabled = !topicId || addResource.isPending || !title.trim();
  const uploadDisabled = !topicId || uploadResource.isPending || !title.trim() || !uploadFile;
  const cameraDisabled = !topicId || uploadResource.isPending || !title.trim() || !cameraBlob;
  const customDisabled = !topicId || createCustom.isPending || !title.trim() || !customDescription.trim();

  return (
    <div
      className="mt-1 rounded border border-border/40 bg-muted/20"
      data-testid={`block-resources-panel-${topicCode}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <span>📎</span>
        <span>Resources{count > 0 ? ` (${count})` : ""}</span>
        <span className="ml-auto opacity-60">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/40 px-2 py-2">
          {/* Existing resources list */}
          {topicByCode.isError ? (
            <p className="text-[11px] text-red-500">
              Could not look up topic <code>{topicCode}</code>: {topicByCode.error?.message ?? "unknown error"}
            </p>
          ) : rollup.isError ? (
            <p className="text-[11px] text-red-500">
              Could not load resources: {rollup.error?.message ?? "unknown error"}
            </p>
          ) : topicByCode.isLoading || rollup.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : !topicId ? (
            <p className="text-[11px] text-muted-foreground">
              Topic <code>{topicCode}</code> not in catalog yet.
            </p>
          ) : resources.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No materials attached yet — add one below.
            </p>
          ) : (
            <ul className="space-y-1">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 text-[11px]"
                  data-testid={`block-resource-row-${r.id}`}
                >
                  <span title={r.kind}>{KIND_BADGE[r.kind as Kind] ?? "📎"}</span>
                  <span className="font-medium">{r.title}</span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      open
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-[11px] text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Remove "${r.title}"?`)) {
                        removeResource.mutate({ id: r.id });
                      }
                    }}
                    disabled={removeResource.isPending}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Tab strip */}
          <div className="flex gap-1 border-b border-border/40 pb-1 text-[11px]">
            {(["link", "upload", "camera", "custom"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-t px-2 py-0.5 ${
                  tab === t ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`block-resources-tab-${t}-${topicCode}`}
              >
                {t === "link" && "🔗 Link"}
                {t === "upload" && "📤 Upload"}
                {t === "camera" && "📷 Camera"}
                {t === "custom" && "✍️ Custom"}
              </button>
            ))}
          </div>

          {/* Common kind + title (shared across all 4 tabs) */}
          <div className="grid items-center gap-1" style={{ gridTemplateColumns: "110px 1fr" }}>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>{KIND_BADGE[k]} {k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-7 text-[11px]"
              placeholder="Title (e.g. Khan: Multi-digit multiplication)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid={`block-resource-title-input-${topicCode}`}
            />
          </div>

          {/* Tab body */}
          {tab === "link" && (
            <div className="grid items-center gap-1" style={{ gridTemplateColumns: "1fr 70px" }}>
              <Input
                className="h-7 text-[11px]"
                placeholder="URL (optional)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid={`block-resource-url-input-${topicCode}`}
              />
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px]"
                disabled={linkDisabled}
                onClick={() => {
                  if (!topicId) return;
                  addResource.mutate({
                    topicId,
                    kind,
                    title: title.trim(),
                    url: url.trim() ? url.trim() : null,
                  });
                }}
                data-testid={`block-resource-add-button-${topicCode}`}
              >
                Add
              </Button>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-1">
              <Input
                type="file"
                accept="application/pdf,image/*"
                className="h-7 text-[11px]"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                data-testid={`block-resource-upload-input-${topicCode}`}
              />
              {uploadFile && (
                <p className="text-[10px] text-muted-foreground">
                  Selected: {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px]"
                disabled={uploadDisabled}
                onClick={async () => {
                  if (!topicId || !uploadFile) return;
                  try {
                    const base64 = await fileToBase64(uploadFile);
                    uploadResource.mutate({
                      topicId,
                      kind,
                      title: title.trim(),
                      fileName: uploadFile.name,
                      mimeType: uploadFile.type || "application/octet-stream",
                      fileData: base64,
                      captureSource: "upload",
                    });
                  } catch (err: any) {
                    toast.error(err?.message || "Could not read file");
                  }
                }}
                data-testid={`block-resource-upload-button-${topicCode}`}
              >
                {uploadResource.isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
          )}

          {tab === "camera" && (
            <div className="space-y-1">
              {!cameraPreviewUrl ? (
                <>
                  {cameraOn ? (
                    <>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full max-h-48 rounded bg-black"
                        data-testid={`block-resource-camera-video-${topicCode}`}
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 flex-1 text-[11px]"
                          onClick={snapPhoto}
                          data-testid={`block-resource-camera-snap-${topicCode}`}
                        >
                          📸 Snap
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => setCameraOn(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 w-full text-[11px]"
                      onClick={() => setCameraOn(true)}
                      data-testid={`block-resource-camera-start-${topicCode}`}
                    >
                      📷 Start camera
                    </Button>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </>
              ) : (
                <>
                  <img
                    src={cameraPreviewUrl}
                    alt="Captured worksheet preview"
                    className="max-h-48 w-full rounded object-contain"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 flex-1 text-[11px]"
                      disabled={cameraDisabled}
                      onClick={async () => {
                        if (!topicId || !cameraBlob) return;
                        try {
                          const base64 = await fileToBase64(cameraBlob);
                          uploadResource.mutate({
                            topicId,
                            kind,
                            title: title.trim(),
                            fileName: `camera-${Date.now()}.jpg`,
                            mimeType: "image/jpeg",
                            fileData: base64,
                            captureSource: "camera",
                          });
                        } catch (err: any) {
                          toast.error(err?.message || "Could not save photo");
                        }
                      }}
                      data-testid={`block-resource-camera-save-${topicCode}`}
                    >
                      {uploadResource.isPending ? "Saving…" : "Save photo"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setCameraBlob(null);
                        setCameraPreviewUrl(null);
                      }}
                    >
                      Retake
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-1">
              <Textarea
                className="min-h-[60px] text-[11px]"
                placeholder='Describe the lesson, activity, or assignment. e.g. "Go outside and count 10 different bird species. Sketch each one in your notebook with a one-sentence observation."'
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                data-testid={`block-resource-custom-textarea-${topicCode}`}
              />
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px]"
                disabled={customDisabled}
                onClick={() => {
                  if (!topicId) return;
                  createCustom.mutate({
                    topicId,
                    kind,
                    title: title.trim(),
                    description: customDescription.trim(),
                  });
                }}
                data-testid={`block-resource-custom-save-${topicCode}`}
              >
                {createCustom.isPending ? "Saving…" : "Save lesson"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockResourcesPanel;
