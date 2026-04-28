import { ReactNode, useState } from "react";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { Link } from "wouter";

/**
 * AdultGate wraps adult-only routes. If the tab is not unlocked,
 * it shows a centered passcode prompt instead of the child route.
 */
export default function AdultGate({ children }: { children: ReactNode }) {
  const { unlocked, unlock } = useAdultLock();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unlock(code)) {
      setCode("");
      setError(false);
    } else {
      setError(true);
      setCode("");
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="classroom-card w-full max-w-sm p-8 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mx-auto">
          <Lock className="w-6 h-6 text-white/80" />
        </div>
        <div>
          <h2 className="font-display text-2xl chalk-white">Adult area</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the 4-digit passcode to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className="text-center text-2xl tracking-[0.4em] font-display h-14"
            placeholder="••••"
          />
          {error && (
            <p className="text-sm text-destructive">That's not the right code.</p>
          )}
          <Button type="submit" className="w-full" size="lg">
            Unlock
          </Button>
        </form>
        <div className="pt-2">
          <Link href="/today" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Reagan's Today
          </Link>
        </div>
      </div>
    </div>
  );
}
