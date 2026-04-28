import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import FlockSprite, { FLOCK_MEMBERS, getFlockMeta } from "./FlockSprite";

/**
 * FlockWidget — shows Reagan's whole flock in a cozy strip on the Today page.
 * Click a bird → future animal-journal page (wired to /profile for now).
 */
export default function FlockWidget() {
  return (
    <Card className="classroom-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-display font-semibold text-base leading-none">
            Your Flock <span className="text-sm text-muted-foreground font-normal">🪶</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Kiwi is at your corner. The rest of the flock says hi too.
          </div>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        {FLOCK_MEMBERS.map((m) => {
          const meta = getFlockMeta(m);
          return (
            <Link
              key={m}
              href="/profile"
              className="group flex flex-col items-center gap-1 rounded-2xl px-3 py-2 bg-background/60 hover:bg-background transition border"
              style={{ borderColor: `${meta.accent}55` }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle at 50% 60%, ${meta.accent}22, transparent 65%)`,
                }}
              >
                <FlockSprite member={m} size={64} />
              </div>
              <div className="text-xs font-semibold">{meta.name}</div>
              <div className="text-[10px] text-muted-foreground -mt-1">{meta.species}</div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
