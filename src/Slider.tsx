import { useId, type CSSProperties } from "react";

import styles from "./Slider.module.css";

export type SliderProps = {
  label: string;
  /** null = no value available (slider disabled). */
  value: number | null;
  min: number;
  max: number;
  /** CSS background for the track, e.g. "linear-gradient(to right, #224, #cc4)". */
  track?: string;
  /** Formats the value shown at the top right. */
  format?: (value: number) => string;
  focused?: boolean;
  onChange: (value: number) => void;
  /** Called on double click (Lightroom-style reset). */
  onReset?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onMouseEnter?: () => void;
  /** Exposed as data-key for event delegation (wheel handling). */
  dataKey?: string;
};

export function Slider({
  label,
  value,
  min,
  max,
  track = "#555",
  format = String,
  focused = false,
  onChange,
  onReset,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  dataKey,
}: SliderProps) {
  const id = useId();
  const disabled = value === null;
  return (
    <div
      className={styles.slider}
      data-key={dataKey}
      data-focused={focused || undefined}
      data-disabled={disabled || undefined}
      style={{ "--track": track } as CSSProperties}
      onMouseEnter={onMouseEnter}
    >
      <div className={styles.header}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{disabled ? "—" : format(value)}</output>
      </div>
      <input
        id={id}
        className={styles.input}
        type="range"
        min={min}
        max={max}
        step="any"
        value={value ?? (min + max) / 2}
        disabled={disabled}
        // Keyboard is handled at the grid level (arrows move focus, +/- change values).
        tabIndex={-1}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={onReset}
        onPointerDown={onDragStart}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      />
    </div>
  );
}
