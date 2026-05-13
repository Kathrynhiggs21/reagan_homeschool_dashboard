/**
 * Push 115 (2026-05-13) — Reagan reward-coin counter pure helper.
 *
 * Per project knowledge: rewards are tracked as **coins** (not stickers,
 * not "feathers"). Adults define rewards manually with a coin price.
 * This helper applies a stream of earn/spend operations to a starting
 * balance, clamps to non-negative, drops malformed ops, and returns a
 * full reason log so the Adult-tier Rewards page can render history.
 *
 * Pure module — no DB, no I/O.
 */

export type CoinOpKind = "earn" | "spend";

export interface CoinOpInput {
  kind: CoinOpKind | string;
  amount: number;
  reason: string;
  /** ISO timestamp (informational only). */
  atIso?: string;
}

export interface CoinOpApplied {
  kind: CoinOpKind;
  amount: number;
  reason: string;
  atIso?: string;
  /** Balance AFTER this op was applied. */
  balanceAfter: number;
}

export interface CoinOpRejected {
  kind: string;
  amount: unknown;
  reason: string;
  atIso?: string;
  rejectReason:
    | "unknown-kind"
    | "non-finite-amount"
    | "non-positive-amount"
    | "missing-reason"
    | "would-overdraw";
}

export interface CoinLedger {
  startingBalance: number;
  endingBalance: number;
  applied: CoinOpApplied[];
  rejected: CoinOpRejected[];
  totalEarned: number;
  totalSpent: number;
}

const KIND_SET = new Set<CoinOpKind>(["earn", "spend"]);

function clean(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

export function applyCoinOps(
  startingBalance: number,
  ops: ReadonlyArray<CoinOpInput>,
): CoinLedger {
  // Floor starting balance to a non-negative integer.
  const start =
    Number.isFinite(startingBalance) && startingBalance >= 0
      ? Math.floor(startingBalance)
      : 0;

  let balance = start;
  let totalEarned = 0;
  let totalSpent = 0;
  const applied: CoinOpApplied[] = [];
  const rejected: CoinOpRejected[] = [];

  if (Array.isArray(ops)) {
    for (const raw of ops) {
      if (!raw || typeof raw !== "object") {
        rejected.push({
          kind: "unknown",
          amount: undefined,
          reason: "",
          rejectReason: "unknown-kind",
        });
        continue;
      }
      const kind = String(raw.kind ?? "").toLowerCase();
      const reason = clean(raw.reason);
      const atIso = typeof raw.atIso === "string" ? raw.atIso : undefined;

      if (!KIND_SET.has(kind as CoinOpKind)) {
        rejected.push({
          kind: kind || "unknown",
          amount: raw.amount,
          reason,
          atIso,
          rejectReason: "unknown-kind",
        });
        continue;
      }
      if (!Number.isFinite(raw.amount)) {
        rejected.push({
          kind,
          amount: raw.amount,
          reason,
          atIso,
          rejectReason: "non-finite-amount",
        });
        continue;
      }
      const amount = Math.floor(raw.amount as number);
      if (amount <= 0) {
        rejected.push({
          kind,
          amount: raw.amount,
          reason,
          atIso,
          rejectReason: "non-positive-amount",
        });
        continue;
      }
      if (reason.length === 0) {
        rejected.push({
          kind,
          amount,
          reason,
          atIso,
          rejectReason: "missing-reason",
        });
        continue;
      }
      if (kind === "spend" && amount > balance) {
        rejected.push({
          kind,
          amount,
          reason,
          atIso,
          rejectReason: "would-overdraw",
        });
        continue;
      }

      if (kind === "earn") {
        balance += amount;
        totalEarned += amount;
      } else {
        balance -= amount;
        totalSpent += amount;
      }
      applied.push({
        kind: kind as CoinOpKind,
        amount,
        reason,
        atIso,
        balanceAfter: balance,
      });
    }
  }

  return {
    startingBalance: start,
    endingBalance: balance,
    applied,
    rejected,
    totalEarned,
    totalSpent,
  };
}
