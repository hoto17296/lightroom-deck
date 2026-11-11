/**
 * Next focused key for an arrow key, or null to keep the current focus.
 *
 * Up/Down follow reading order across columns, so they also work when the
 * responsive layout stacks the columns vertically. Left/Right jump to the
 * same row in the adjacent column (clamped to its last row).
 */
export const moveFocus = (
  columns: readonly (readonly { key: string }[])[],
  key: string,
  arrow: string,
): string | null => {
  const col = columns.findIndex((c) => c.some((p) => p.key === key));
  if (col < 0) return null;
  const row = columns[col].findIndex((p) => p.key === key);
  const order = columns.flat();
  const index = order.findIndex((p) => p.key === key);
  switch (arrow) {
    case "ArrowUp":
      return order[index - 1]?.key ?? null;
    case "ArrowDown":
      return order[index + 1]?.key ?? null;
    case "ArrowLeft":
    case "ArrowRight": {
      const target = columns[col + (arrow === "ArrowLeft" ? -1 : 1)];
      if (!target?.length) return null;
      return target[Math.min(row, target.length - 1)].key;
    }
    default:
      return null;
  }
};
