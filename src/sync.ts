import type { ParamDef } from "./params.ts";

/** Give up after this many rounds that do not converge on the same target. */
export const MAX_SYNC_ROUNDS = 6;

/** Per-parameter bookkeeping for pushing UI values to Lightroom. */
export type SyncState = {
  /** Last value known to be applied in Lightroom. */
  applied: number | null;
  /** Value the UI wants Lightroom to have. */
  target: number | null;
  /** Latest value shown in the UI (base for relative nudges). */
  ui: number | null;
  /** Learned (change in value) / (increment amount). */
  scale: number;
  syncing: boolean;
  dragging: boolean;
};

export const newSyncState = (p: Pick<ParamDef, "amountScale">): SyncState => ({
  applied: null,
  target: null,
  ui: null,
  scale: p.amountScale,
  syncing: false,
  dragging: false,
});

export const isBusy = (s: SyncState) => s.syncing || s.dragging;

/** Rounds to the param's precision and clamps to its range. */
export const quantize = (p: Pick<ParamDef, "min" | "max" | "precision">, v: number) =>
  Math.min(p.max, Math.max(p.min, Math.round(v / p.precision) * p.precision));

/** The subset of LightroomClient that syncing needs. */
export type Adjuster = {
  adjust(parameter: string, delta: number): Promise<void>;
  getValue(parameter: string): Promise<number | null>;
};

/**
 * Moves the Lightroom value towards `s.target` with relative adjustments,
 * reading the value back after each one. `s.target` may change while this
 * runs (e.g. during a drag); the loop keeps chasing the latest target.
 *
 * Learns `s.scale` from observed changes, so params whose increment
 * `amount` is not in value units (e.g. Temperature) still converge.
 */
export async function syncToTarget(
  client: Adjuster,
  p: Pick<ParamDef, "key" | "min" | "max" | "precision">,
  s: SyncState,
): Promise<void> {
  // The last polled value may be up to one poll interval old (the user may have
  // changed it in Lightroom since). Start from a fresh reading so the first
  // delta, and the ratio learned from it, are correct.
  const current = await client.getValue(p.key);
  if (current === null) return;
  s.applied = current;

  let lastTarget: number | null = null;
  let rounds = 0;
  for (;;) {
    if (s.target === null || s.applied === null) return;
    // The round budget restarts whenever the UI sets a new target.
    if (s.target !== lastTarget) {
      lastTarget = s.target;
      rounds = 0;
    } else if (++rounds >= MAX_SYNC_ROUNDS) {
      return;
    }
    const delta = s.target - s.applied;
    if (Math.abs(delta) < p.precision / 2) return;

    const amount = delta / s.scale;
    await client.adjust(p.key, amount);
    const next = await client.getValue(p.key);
    if (next === null) return;

    // Learn how much Lightroom actually moves per unit of `amount`.
    // (A move clamped at min/max ends exactly at the target, which is within
    // range, so it yields the current scale and needs no special case.)
    const moved = next - s.applied;
    if (Math.sign(moved) === Math.sign(delta) && Math.abs(moved) > 1e-9) {
      s.scale = moved / amount;
    }
    s.applied = next;
  }
}
