/** Lightroom-style signed number: "+ 0.74", "- 12", "0". */
export const signed = (digits: number) => (v: number) => {
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return `${v > 0 ? "+" : "-"} ${s}`;
};
