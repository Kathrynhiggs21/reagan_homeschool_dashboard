/**
 * Push 69 (2026-05-13) — Slice 5 catch-up engine stub.
 *
 * Pure function that builds a "next-day nudges" queue from yesterday's
 * missed planned topics. No DB / LLM calls — the caller hydrates inputs.
 *
 *   - Cap respected (Mom-toggle, default 3).
 *   - Subject-rotation: never queue two of the same subject back-to-back
 *     unless there's nothing else to pick.
 *   - Deterministic: same inputs → same queue (FNV-1a seeded).
 *   - Skips topics already marked done today.
 */

export interface MissedTopic {
  subjectSlug: string;
  topic: string;
  missedOn: string; // ISO date — used as part of seed for determinism
}

export interface CatchUpInput {
  missed: MissedTopic[];
  alreadyDoneTodayKeys?: string[]; // "subjectSlug::topic" pairs
  maxQueueSize?: number; // Mom-toggle, defaults 3
  seed?: string; // optional override seed
}

export interface CatchUpQueueItem {
  subjectSlug: string;
  topic: string;
  missedOn: string;
  key: string; // "subjectSlug::topic"
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function catchUpQueueFor(input: CatchUpInput): CatchUpQueueItem[] {
  const cap = Math.max(0, Math.min(input.maxQueueSize ?? 3, 10));
  if (cap === 0) return [];
  const done = new Set(input.alreadyDoneTodayKeys ?? []);
  // Dedupe by key, drop done topics.
  const seen = new Set<string>();
  const candidates: CatchUpQueueItem[] = [];
  for (const m of input.missed) {
    const key = `${m.subjectSlug}::${m.topic}`;
    if (done.has(key) || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ subjectSlug: m.subjectSlug, topic: m.topic, missedOn: m.missedOn, key });
  }
  if (candidates.length === 0) return [];

  // Deterministic sort: by missedOn desc, then by stable hash with seed.
  const seed = input.seed ?? candidates[0]?.missedOn ?? "default";
  candidates.sort((a, b) => {
    if (a.missedOn !== b.missedOn) return a.missedOn > b.missedOn ? -1 : 1;
    return fnv1a(seed + a.key) - fnv1a(seed + b.key);
  });

  // Subject-rotation: greedy pick, avoid same subject as previous slot.
  const queue: CatchUpQueueItem[] = [];
  const remaining = [...candidates];
  while (queue.length < cap && remaining.length > 0) {
    const lastSlug = queue[queue.length - 1]?.subjectSlug;
    let pickIdx = remaining.findIndex((c) => c.subjectSlug !== lastSlug);
    if (pickIdx === -1) pickIdx = 0; // forced repeat
    queue.push(remaining.splice(pickIdx, 1)[0]);
  }
  return queue;
}
