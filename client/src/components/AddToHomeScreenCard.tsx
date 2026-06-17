import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, Check } from "lucide-react";

/**
 * AddToHomeScreenCard
 * An always-available "Add to Home Screen" helper for Settings. Unlike the
 * auto-prompt chip (which can be dismissed once and not return), this card is
 * always present so Mom or Reagan can install the app anytime.
 * - Android/Chrome: captures `beforeinstallprompt` and offers a one-tap Install.
 * - iOS/Safari: shows the Share -> Add to Home Screen steps (no install event).
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function AddToHomeScreenCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isStandalone()) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isIos = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  return (
    <Card className="p-5 bg-white">
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="h-5 w-5 text-teal-600" />
        <div className="font-semibold text-base">Add to Home Screen</div>
      </div>
      <p className="text-xs opacity-70 mb-4">
        Put <strong>Reagan's Homeschool</strong> on your phone or tablet so it opens like a
        real app — full screen, with the Kiwi icon.
      </p>

      {installed ? (
        <div className="flex items-center gap-2 text-sm text-teal-700 font-medium">
          <Check className="h-4 w-4" /> Installed — look for the Kiwi icon on your home screen.
        </div>
      ) : deferred ? (
        <Button onClick={install} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add to Home Screen
        </Button>
      ) : isIos ? (
        <ol className="text-sm space-y-2 list-decimal pl-5">
          <li className="flex items-center gap-1">
            Tap the <Share className="h-4 w-4 inline" /> <strong>Share</strong> button at the
            bottom of Safari.
          </li>
          <li>
            Scroll down and tap <strong>“Add to Home Screen.”</strong>
          </li>
          <li>
            Tap <strong>Add</strong> — the Kiwi icon appears on your home screen.
          </li>
        </ol>
      ) : (
        <ol className="text-sm space-y-2 list-decimal pl-5">
          <li>
            Open the browser menu (the <strong>⋮</strong> in the top-right).
          </li>
          <li>
            Tap <strong>“Add to Home screen”</strong> (or “Install app”).
          </li>
          <li>
            Confirm — the Kiwi icon appears on your home screen.
          </li>
        </ol>
      )}
    </Card>
  );
}
