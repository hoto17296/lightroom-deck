import { describe, expect, test } from "bun:test";

import { moveFocus } from "./navigation.ts";
import { COLUMNS } from "./params.ts";

const cols = [
  [{ key: "a1" }, { key: "a2" }, { key: "a3" }],
  [{ key: "b1" }, { key: "b2" }],
  [{ key: "c1" }],
];

describe("moveFocus", () => {
  test("Up/Down move within a column", () => {
    expect(moveFocus(cols, "a1", "ArrowDown")).toBe("a2");
    expect(moveFocus(cols, "a2", "ArrowUp")).toBe("a1");
  });

  test("Up/Down continue across columns in reading order", () => {
    expect(moveFocus(cols, "a3", "ArrowDown")).toBe("b1");
    expect(moveFocus(cols, "b1", "ArrowUp")).toBe("a3");
  });

  test("Up/Down stop at the ends", () => {
    expect(moveFocus(cols, "a1", "ArrowUp")).toBeNull();
    expect(moveFocus(cols, "c1", "ArrowDown")).toBeNull();
  });

  test("Left/Right keep the row, clamped to the target column's length", () => {
    expect(moveFocus(cols, "a2", "ArrowRight")).toBe("b2");
    expect(moveFocus(cols, "a3", "ArrowRight")).toBe("b2");
    expect(moveFocus(cols, "b2", "ArrowRight")).toBe("c1");
    expect(moveFocus(cols, "b2", "ArrowLeft")).toBe("a2");
  });

  test("Left/Right stop at the outer columns", () => {
    expect(moveFocus(cols, "a1", "ArrowLeft")).toBeNull();
    expect(moveFocus(cols, "c1", "ArrowRight")).toBeNull();
  });

  test("ignores unknown keys and unknown params", () => {
    expect(moveFocus(cols, "a1", "Enter")).toBeNull();
    expect(moveFocus(cols, "zz", "ArrowDown")).toBeNull();
  });

  test("works with the real layout", () => {
    expect(moveFocus(COLUMNS, "Blacks2012", "ArrowDown")).toBe("Temperature");
    expect(moveFocus(COLUMNS, "PostCropVignetteAmount", "ArrowRight")).toBe("straightenAngle");
  });
});
