/**
 * RobloxTile — adult-controlled Roblox launcher.
 *
 * Behavior:
 *   - Reads the public pref `roblox.allowed` ("1" / "0"); default = hidden.
 *   - When allowed, shows a single big tile that opens Roblox in a new tab
 *     (link is intentional and lazy-loaded so we don't preload a noisy site).
 *   - When NOT allowed, the tile renders nothing (zero footprint for Reagan).
 *
 * Adults flip this from Settings -> "Reagan choices" -> Roblox toggle.
 */
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ROBLOX_URL = "https://www.roblox.com/home";

export default function RobloxTile() {
  const q = trpc.prefs.getPublic.useQuery({ key: "roblox.allowed" });
  const allowed = q.data === "1";
  if (q.isLoading) return null;
  if (!allowed) return null;

  return (
    <Card
      className="p-4 flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg, #ffe9f1 0%, #ffd1dc 100%)",
        border: "2px solid #ff6b9a",
        color: "#2a0d18",
      }}
    >
      <div className="text-4xl shrink-0" aria-hidden>🎮</div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-lg leading-tight">Roblox break</div>
        <div className="text-[12px] opacity-80">
          A short reset session — Mom said it's okay today.
        </div>
      </div>
      <Button
        asChild
        className="bg-rose-500 hover:bg-rose-600 text-white"
        size="sm"
      >
        <a href={ROBLOX_URL} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      </Button>
    </Card>
  );
}
