import { describe, expect, test } from "bun:test";

import { MAX_SYNC_ROUNDS, newSyncState, quantize, syncToTarget, type Adjuster } from "./sync.ts";

/**
 * Fake Lightroom parameter: `increment amount` changes the value by
 * `amount * ratio`, clamped to [min, max].
 */
type FakeLightroom = {
  value: number | null;
  adjustCalls: number[];
  onAdjust?: () => void;
  client: Adjuster;
};

const fakeLightroom = (opts: { value: number; ratio: number; min?: number; max?: number }) => {
  const { min = -100, max = 100 } = opts;
  const lr: FakeLightroom = {
    value: opts.value,
    adjustCalls: [],
    client: {
      async adjust(_key: string, delta: number) {
        lr.adjustCalls.push(delta);
        if (lr.value !== null) lr.value = Math.min(max, Math.max(min, lr.value + delta * opts.ratio));
        lr.onAdjust?.();
      },
      async getValue() {
        return lr.value;
      },
    },
  };
  return lr;
};

const param = { key: "X", min: -100, max: 100, precision: 1 };

const stateAt = (value: number, target: number, scale = 1) => ({
  ...newSyncState({ amountScale: scale }),
  applied: value,
  ui: target,
  target,
});

describe("syncToTarget", () => {
  test("reaches the target in one adjustment when amount is in value units", async () => {
    const lr = fakeLightroom({ value: 10, ratio: 1 });
    const s = stateAt(10, 35);
    await syncToTarget(lr.client, param, s);
    expect(lr.value).toBe(35);
    expect(s.applied).toBe(35);
    expect(lr.adjustCalls).toEqual([25]);
  });

  test("decreases with a negative delta", async () => {
    const lr = fakeLightroom({ value: 10, ratio: 1 });
    await syncToTarget(lr.client, param, stateAt(10, -5));
    expect(lr.value).toBe(-5);
    expect(lr.adjustCalls).toEqual([-15]);
  });

  test("does nothing when already within precision", async () => {
    const lr = fakeLightroom({ value: 10, ratio: 1 });
    await syncToTarget(lr.client, param, stateAt(10, 10.4));
    expect(lr.adjustCalls).toEqual([]);
  });

  test("learns the amount ratio (Temperature-like) and converges", async () => {
    // Lightroom moves only 1/100 of the amount, but our initial guess is 1.
    const lr = fakeLightroom({ value: 14, ratio: 0.01, min: 0, max: 100 });
    const s = stateAt(14, 30, 1);
    await syncToTarget(lr.client, { ...param, min: 0, max: 100, precision: 0.01 }, s);
    expect(lr.value).toBeCloseTo(30, 2);
    expect(s.scale).toBeCloseTo(0.01, 6);
    expect(lr.adjustCalls.length).toBe(2);
  });

  test("chases a target that changes while a request is in flight", async () => {
    const lr = fakeLightroom({ value: 0, ratio: 1 });
    const s = stateAt(0, 10);
    lr.onAdjust = () => {
      if (lr.adjustCalls.length === 1) s.target = 40; // user kept dragging
    };
    await syncToTarget(lr.client, param, s);
    expect(lr.value).toBe(40);
    expect(lr.adjustCalls).toEqual([10, 30]);
  });

  test("stops when the photo is closed (getValue returns null)", async () => {
    const lr = fakeLightroom({ value: 0, ratio: 1 });
    lr.onAdjust = () => (lr.value = null);
    await syncToTarget(lr.client, param, stateAt(0, 10));
    expect(lr.adjustCalls.length).toBe(1);
  });

  test("gives up after MAX_SYNC_ROUNDS when Lightroom does not move", async () => {
    const lr = fakeLightroom({ value: 0, ratio: 0 });
    await syncToTarget(lr.client, param, stateAt(0, 10));
    expect(lr.adjustCalls.length).toBe(MAX_SYNC_ROUNDS);
  });

  test("starts from a fresh value when Lightroom changed since the last poll", async () => {
    // Last poll saw 50, but the user has since moved it to 80 in Lightroom.
    const lr = fakeLightroom({ value: 80, ratio: 1 });
    const s = stateAt(50, 60);
    await syncToTarget(lr.client, param, s);
    expect(lr.value).toBe(60);
    expect(lr.adjustCalls).toEqual([-20]);
    expect(s.scale).toBe(1);
  });
});

describe("quantize", () => {
  test("rounds to precision and clamps to the range", () => {
    const p = { min: -5, max: 5, precision: 0.01 };
    expect(quantize(p, 0.744)).toBeCloseTo(0.74, 10);
    expect(quantize(p, 7)).toBe(5);
    expect(quantize(p, -7)).toBe(-5);
  });

  test("supports non-decimal precision (Tint: 1/3)", () => {
    const p = { min: 0, max: 100, precision: 1 / 3 };
    // 54 = display +12; nudging by one display unit gives 54.333…
    expect(quantize(p, 54 + 0.3)).toBeCloseTo(54 + 1 / 3, 10);
  });
});
