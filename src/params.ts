import { signed } from "./format.ts";
import type { Localized } from "./i18n.ts";

export type ParamDef = {
  /** Parameter name used by the Lightroom External Controller API. */
  key: string;
  label: Localized;
  /** Grid column (0-based). */
  column: number;
  /** Range in API units. */
  min: number;
  max: number;
  /** Resolution values are rounded to (API units). */
  precision: number;
  /** Change per keyboard press / wheel notch (API units). */
  step: number;
  /** Value restored on double click; omitted when the real default is unknown. */
  defaultValue?: number;
  /**
   * Initial guess of (change in value) / (increment amount).
   * Refined at runtime from observed changes.
   */
  amountScale: number;
  format: (value: number) => string;
  track?: string;
};

// ---- Temperature: API 0..100 <-> Kelvin (piecewise linear, measured in Lightroom 9.6) ----
const TEMPERATURE_TABLE: [number, number][] = [
  [0, 2000],
  [50, 7000],
  [62, 8500],
  [69.5, 10000],
  [79.5, 15000],
  [85, 20000],
  [100, 50000],
];

export const temperatureToKelvin = (v: number): number => {
  const table = TEMPERATURE_TABLE;
  if (v <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, k1] = table[i];
    if (v <= x1) {
      const [x0, k0] = table[i - 1];
      return k0 + ((v - x0) / (x1 - x0)) * (k1 - k0);
    }
  }
  return table[table.length - 1][1];
};

// ---- Tint: API 0..100 <-> Lightroom -150..+150 ----
const tintToDisplay = (v: number) => (v - 50) * 3;

const gray = "linear-gradient(to right, #1a1a1a, #d8d8d8)";

const basic = (
  key: string,
  ja: string,
  en: string,
  column: number,
  track: string = gray,
): ParamDef => ({
  key,
  label: { ja, en },
  column,
  min: -100,
  max: 100,
  precision: 1,
  step: 1,
  defaultValue: 0,
  amountScale: 1,
  format: signed(0),
  track,
});

export const PARAMS: ParamDef[] = [
  // Column 1: tone
  {
    key: "Exposure2012",
    label: { ja: "露光量", en: "Exposure" },
    column: 0,
    min: -5,
    max: 5,
    precision: 0.01,
    step: 0.05,
    defaultValue: 0,
    amountScale: 1,
    format: signed(2),
    track: gray,
  },
  basic("Contrast2012", "コントラスト", "Contrast", 0),
  basic("Highlights2012", "ハイライト", "Highlights", 0),
  basic("Shadows2012", "シャドウ", "Shadows", 0),
  basic("Whites2012", "白レベル", "Whites", 0),
  basic("Blacks2012", "黒レベル", "Blacks", 0),

  // Column 2: color & effects
  {
    key: "Temperature",
    label: { ja: "色温度", en: "Temp" },
    column: 1,
    min: 0,
    max: 100,
    precision: 0.01,
    step: 0.5,
    amountScale: 0.01,
    format: (v) => Math.round(temperatureToKelvin(v)).toLocaleString("en-US"),
    track: "linear-gradient(to right, #2c5aa0, #8a8a6a, #c8b432)",
  },
  {
    key: "Tint",
    label: { ja: "色かぶり補正", en: "Tint" },
    column: 1,
    min: 0,
    max: 100,
    precision: 1 / 3,
    step: 1 / 3,
    // API 50 = display 0
    defaultValue: 50,
    amountScale: 0.01,
    format: (v) => signed(0)(Math.round(tintToDisplay(v))),
    track: "linear-gradient(to right, #2e8b3a, #555 50%, #a03aa8)",
  },
  basic(
    "Vibrance",
    "自然な彩度",
    "Vibrance",
    1,
    "linear-gradient(to right, #444, #4a7a8a 30%, #5a9a5a 50%, #b0a030 75%, #b03030)",
  ),
  basic(
    "Saturation",
    "彩度",
    "Saturation",
    1,
    "linear-gradient(to right, #444, #6a5a8a 25%, #4a8a7a 50%, #a0a030 75%, #b03030)",
  ),
  basic("Dehaze", "かすみの除去", "Dehaze", 1, "linear-gradient(to right, #d8d8d8, #1a1a1a)"),
  basic("PostCropVignetteAmount", "周辺光量補正", "Vignette", 1),

  // Column 3: geometry
  {
    key: "straightenAngle",
    label: { ja: "角度補正", en: "Straighten" },
    column: 2,
    min: -45,
    max: 45,
    precision: 0.1,
    step: 0.1,
    defaultValue: 0,
    amountScale: 1,
    format: signed(1),
    track: "#555",
  },
];

export const COLUMNS: ParamDef[][] = [0, 1, 2].map((c) => PARAMS.filter((p) => p.column === c));
