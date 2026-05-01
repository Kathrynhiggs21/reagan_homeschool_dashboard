/**
 * AppAccountsCard — adult-only.
 *
 * One row per learning app Reagan uses (or will use). Tracks signup status,
 * stores the email/username she signs in with, and offers an encrypted
 * password locker. Lives inside Adult Settings.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type AccountStatus = "not_started" | "pending_email_verify" | "pending_family_link" | "active" | "needs_reset" | "closed";

const STATUS_META: Record<AccountStatus, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "#9ca3af" },
  pending_email_verify: { label: "Verify email", color: "#f59e0b" },
  pending_family_link: { label: "Family Link approval", color: "#8b5cf6" },
  active: { label: "Active", color: "#10b981" },
  needs_reset: { label: "Needs reset", color: "#ef4444" },
  closed: { label: "Closed", color: "#6b7280" },
};

const STATUSES: AccountStatus[] = ["not_started", "pending_email_verify", "pending_family_link", "active", "needs_reset", "closed"];

export function AppAccountsCard() {
  const utils = trpc.useUtils();
  const list = trpc.appAccounts.list.useQuery();
  const upsertStatus = trpc.appAccounts.upsertStatus.useMutation({
    onSuccess: () => utils.appAccounts.list.invalidate(),
  });
  const setPassword = trpc.appAccounts.setPassword.useMutation({
    onSuccess: () => utils.appAccounts.list.invalidate(),
  });
  const clearPassword = trpc.appAccounts.clearPassword.useMutation({
    onSuccess: () => utils.appAccounts.list.invalidate(),
  });

  const rows = list.data || [];

  const counts = useMemo(() => {
    const out: Record<string, number> = { active: 0, pending: 0, todo: 0, closed: 0 };
    for (const r of rows) {
      if (r.status === "active") out.active++;
      else if (r.status === "pending_email_verify" || r.status === "pending_family_link" || r.status === "needs_reset") out.pending++;
      else if (r.status === "closed") out.closed++;
      else out.todo++;
    }
    return out;
  }, [rows]);

  return (
    <section className="rounded-xl border border-[var(--cozy-line)] bg-[var(--cozy-card)] p-4 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-lg font-semibold m-0">Reagan's app accounts</h3>
          <p className="text-sm opacity-70 m-0">
            Sign her up using <code>reaganhiggs910@gmail.com</code> (Family Link parent: <code>spear.cpt@gmail.com</code>).
            Passwords stored encrypted on the server, only adults can reveal them.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span><strong>{counts.active}</strong> active</span>
          <span><strong>{counts.pending}</strong> pending</span>
          <span><strong>{counts.todo}</strong> to do</span>
          <span><strong>{counts.closed}</strong> closed</span>
        </div>
      </header>

      {list.isLoading && <p className="text-sm opacity-70">Loading…</p>}
      {list.error && <p className="text-sm text-red-600">Couldn't load app accounts: {list.error.message}</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r: any) => (
          <AppAccountRow
            key={r.id}
            row={r}
            onStatusChange={(status) => upsertStatus.mutate({ id: r.id, status })}
            onEmailChange={(email) => upsertStatus.mutate({ id: r.id, signInEmail: email || null })}
            onUsernameChange={(username) => upsertStatus.mutate({ id: r.id, signInUsername: username || null })}
            onSavePassword={(password) => setPassword.mutate({ id: r.id, password })}
            onClearPassword={() => clearPassword.mutate({ id: r.id })}
          />
        ))}
      </div>
    </section>
  );
}

function AppAccountRow({
  row,
  onStatusChange,
  onEmailChange,
  onUsernameChange,
  onSavePassword,
  onClearPassword,
}: {
  row: any;
  onStatusChange: (s: AccountStatus) => void;
  onEmailChange: (e: string) => void;
  onUsernameChange: (u: string) => void;
  onSavePassword: (p: string) => void;
  onClearPassword: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pw, setPw] = useState("");
  const [reveal, setReveal] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const meta = STATUS_META[row.status as AccountStatus] || STATUS_META.not_started;

  const revealQ = trpc.appAccounts.revealPassword.useQuery(
    { id: row.id },
    { enabled: false },
  );

  async function doReveal() {
    const r = await revealQ.refetch();
    setRevealed(r.data?.password ?? null);
    setReveal(true);
  }

  return (
    <div className="rounded-lg border border-[var(--cozy-line)] p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        <span aria-hidden className="text-2xl">{row.emoji || "🌐"}</span>
        <span className="flex-1 min-w-0">
          <span className="font-medium block truncate">{row.appName}</span>
          <span className="text-xs opacity-70 truncate block">
            {row.signInEmail || (row.signInUsername ? `@${row.signInUsername}` : "no account yet")}
            {row.isPaid ? " · paid" : ""}
            {row.hasFamilyTier ? " · family tier available" : ""}
          </span>
        </span>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{ background: meta.color + "22", color: meta.color }}
        >
          {meta.label}
        </span>
        <span aria-hidden className="opacity-60 ml-2">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs flex flex-col gap-1">
            <span className="opacity-70">Sign-in email</span>
            <input
              type="email"
              defaultValue={row.signInEmail || ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (row.signInEmail || "")) onEmailChange(v);
              }}
              placeholder="reaganhiggs910@gmail.com"
              className="px-2 py-1 rounded border border-[var(--cozy-line)] bg-[var(--cozy-bg)] text-sm"
            />
          </label>

          <label className="text-xs flex flex-col gap-1">
            <span className="opacity-70">Username (if different)</span>
            <input
              type="text"
              defaultValue={row.signInUsername || ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (row.signInUsername || "")) onUsernameChange(v);
              }}
              className="px-2 py-1 rounded border border-[var(--cozy-line)] bg-[var(--cozy-bg)] text-sm"
            />
          </label>

          <label className="text-xs flex flex-col gap-1 sm:col-span-2">
            <span className="opacity-70">Status</span>
            <select
              value={row.status}
              onChange={(e) => onStatusChange(e.target.value as AccountStatus)}
              className="px-2 py-1 rounded border border-[var(--cozy-line)] bg-[var(--cozy-bg)] text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 rounded-md border border-dashed border-[var(--cozy-line)] p-3 bg-[var(--cozy-bg)]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-medium">Password locker</span>
              {row.hasPassword ? (
                <span className="text-xs text-emerald-600">stored (encrypted)</span>
              ) : (
                <span className="text-xs opacity-60">none stored</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={row.hasPassword ? "Replace stored password…" : "Type the password to store…"}
                className="flex-1 min-w-[10rem] px-2 py-1 rounded border border-[var(--cozy-line)] bg-[var(--cozy-card)] text-sm"
              />
              <button
                type="button"
                onClick={() => { if (pw) { onSavePassword(pw); setPw(""); } }}
                className="px-3 py-1 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
                disabled={!pw}
              >Save</button>
              {row.hasPassword && (
                <>
                  <button
                    type="button"
                    onClick={doReveal}
                    className="px-3 py-1 rounded bg-amber-500 text-white text-xs"
                  >Reveal</button>
                  <button
                    type="button"
                    onClick={() => { if (confirm("Clear stored password?")) onClearPassword(); }}
                    className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                  >Clear</button>
                </>
              )}
            </div>
            {reveal && (
              <p className="mt-2 text-xs">
                {revealed === null
                  ? "Couldn't reveal (locker may be empty or key rotated)."
                  : <>Password: <code className="px-1 py-0.5 rounded bg-yellow-100 text-yellow-900">{revealed}</code></>}
                <button
                  type="button"
                  onClick={() => { setReveal(false); setRevealed(null); }}
                  className="ml-2 underline opacity-70"
                >hide</button>
              </p>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2 text-xs">
            <a href={row.appUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border border-[var(--cozy-line)]">
              Open app ↗
            </a>
            {row.signupUrl && (
              <a href={row.signupUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded bg-blue-600 text-white">
                Sign up with reaganhiggs910@gmail.com ↗
              </a>
            )}
            {row.notes && <p className="opacity-70 m-0 w-full">{row.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default AppAccountsCard;
