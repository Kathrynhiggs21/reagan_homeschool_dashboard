import { useEffect, useState } from "react";

/**
 * PwaInstallPrompt
 * - Registers the service worker (production only; dev SW interferes with Vite HMR).
 * - Shows a small, dismissible "Add to Home Screen" chip when the browser fires
 *   `beforeinstallprompt` (Chrome/Edge/Android). On iOS Safari there is no event,
 *   so we show a one-time gentle hint instead.
 * - Honors a localStorage dismissal so it never nags.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "reagan-pwa-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  // Register the service worker once, in production only.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return; // avoid clobbering Vite dev server
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari has no beforeinstallprompt — show a gentle hint instead.
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isSafari = /safari/.test(ua) && !/crios|fxios|chrome/.test(ua);
    if (isIos && isSafari) {
      const t = setTimeout(() => setIosHint(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!show && !iosHint) return null;

  return (
    <div
      role="dialog"
      aria-label="Add Reagan's Homeschool to your home screen"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: 420,
        width: "calc(100% - 24px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 18,
          background: "#fffbf2",
          color: "#1f3a2e",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          border: "2px solid #2f9e8f",
        }}
      >
        <img
          src="/manus-storage/pwa-icon-192_be871fe0.png"
          alt=""
          width={44}
          height={44}
          style={{ borderRadius: 12, flex: "0 0 auto" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Add to your home screen</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {iosHint
              ? "Tap the Share button, then “Add to Home Screen.”"
              : "Open Reagan's Homeschool like a real app."}
          </div>
        </div>
        {show && !iosHint ? (
          <button
            onClick={install}
            style={{
              flex: "0 0 auto",
              fontWeight: 800,
              fontSize: 14,
              padding: "8px 14px",
              borderRadius: 12,
              background: "#2f9e8f",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Add
          </button>
        ) : null}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            flex: "0 0 auto",
            fontSize: 18,
            lineHeight: 1,
            padding: "6px 8px",
            borderRadius: 10,
            background: "transparent",
            color: "#1f3a2e",
            border: "none",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
