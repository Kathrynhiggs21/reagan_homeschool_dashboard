/**
 * /approvals — adult-only Pending tab.
 *
 * v3.16 (2026-05-30) — gives the Approvals queue a dedicated page in the
 * adult area instead of being buried in /settings. Hosts the
 * `ApprovalsAdminCard` (which already has the two sub-tabs:
 * "Needs your review" + "AI auto-approved last 24h").
 *
 * Wrapped in <AdultGate> at the route level in App.tsx so this page is
 * only reachable after the adult unlock prompt.
 */
import ApprovalsAdminCard from "@/components/ApprovalsAdminCard";

export default function ApprovalsPage() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm opacity-70">
          Tutor / system / AI requests that need a Mom or Grandma decision,
          plus a 24-hour view of what the AI auto-approved overnight.
        </p>
      </header>
      <ApprovalsAdminCard />
    </div>
  );
}
