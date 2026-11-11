import { describe, expect, test } from "bun:test";

import { signed } from "./format.ts";
import { COLUMNS, PARAMS, temperatureToKelvin } from "./params.ts";

const param = (key: string) => PARAMS.find((p) => p.key === key)!;

describe("temperatureToKelvin", () => {
  // API value -> Kelvin shown by Lightroom 9.6 (measured).
  const measured: [number, number][] = [
    [14, 3400],
    [50, 7000],
    [62.0797, 8516],
    [69.3976, 9980],
    [73.5794, 12040],
    [79.4151, 14958],
    [84.997, 19994],
    [92.4663, 34933],
  ];

  test.each(measured)("API %p ≈ %p K", (v, kelvin) => {
    expect(Math.abs(temperatureToKelvin(v) - kelvin)).toBeLessThanOrEqual(5);
  });

  test("covers Lightroom's 2000–50000 K range and clamps outside it", () => {
    expect(temperatureToKelvin(0)).toBe(2000);
    expect(temperatureToKelvin(100)).toBe(50000);
    expect(temperatureToKelvin(-1)).toBe(2000);
    expect(temperatureToKelvin(101)).toBe(50000);
  });

  test("is monotonically increasing", () => {
    let prev = -Infinity;
    for (let v = 0; v <= 100; v += 0.5) {
      const k = temperatureToKelvin(v);
      expect(k).toBeGreaterThan(prev);
      prev = k;
    }
  });
});

describe("display formats", () => {
  test("Temperature shows Kelvin with a thousands separator", () => {
    expect(param("Temperature").format(14)).toBe("3,400");
  });

  test("Tint maps API 0..100 to Lightroom's -150..+150", () => {
    const fmt = param("Tint").format;
    expect(fmt(54)).toBe("+ 12");
    expect(fmt(50)).toBe("0");
    expect(fmt(0)).toBe("- 150");
    expect(fmt(100)).toBe("+ 150");
  });

  test("signed() renders Lightroom-style values", () => {
    expect(signed(2)(0.74)).toBe("+ 0.74");
    expect(signed(0)(-12)).toBe("- 12");
    expect(signed(0)(0)).toBe("0");
    // Rounds to zero without a sign
    expect(signed(1)(-0.04)).toBe("0.0");
  });
});

describe("PARAMS", () => {
  test("keys are unique and every param is in a column", () => {
    const keys = PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(COLUMNS.flat().length).toBe(PARAMS.length);
  });

  test("defaults and steps are within range", () => {
    for (const p of PARAMS) {
      if (p.defaultValue !== undefined) {
        expect(p.defaultValue).toBeGreaterThanOrEqual(p.min);
        expect(p.defaultValue).toBeLessThanOrEqual(p.max);
      }
      expect(p.step).toBeGreaterThan(0);
      expect(p.step).toBeGreaterThanOrEqual(p.precision);
    }
  });

  test("Temperature has no reset (the photo-specific default is unavailable)", () => {
    expect(param("Temperature").defaultValue).toBeUndefined();
  });
});
