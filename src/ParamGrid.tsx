import { useEffect, useRef, useState } from "react";

import { t } from "./i18n.ts";
import { moveFocus } from "./navigation.ts";
import { COLUMNS, PARAMS, type ParamDef } from "./params.ts";
import { Slider } from "./Slider.tsx";
import styles from "./ParamGrid.module.css";
import type { Values } from "./useLightroom.ts";

/** Pixels of wheel delta per step (trackpads emit many small deltas). */
const WHEEL_PX_PER_STEP = 40;

type Props = {
  values: Values;
  setValue: (p: ParamDef, v: number) => void;
  nudge: (p: ParamDef, steps: number) => void;
  setDragging: (p: ParamDef, dragging: boolean) => void;
};

const byKey = new Map(PARAMS.map((p) => [p.key, p]));

export function ParamGrid({ values, setValue, nudge, setDragging }: Props) {
  const [focused, setFocused] = useState(PARAMS[0].key);
  const gridRef = useRef<HTMLDivElement>(null);

  // Latest callbacks/state for the native listeners below.
  const latest = useRef({ focused, nudge });
  useEffect(() => {
    latest.current = { focused, nudge };
  });

  // Keyboard: arrows move focus, +/- change the focused value.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { focused, nudge } = latest.current;
      if (e.key.startsWith("Arrow")) {
        // Also stops native range inputs from handling arrows and the page from scrolling.
        e.preventDefault();
        const next = moveFocus(COLUMNS, focused, e.key);
        if (next) {
          setFocused(next);
          gridRef.current
            ?.querySelector(`[data-key="${next}"]`)
            ?.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      const steps = e.key === "+" || e.key === "=" ? 1 : e.key === "-" || e.key === "_" ? -1 : 0;
      if (steps) {
        e.preventDefault();
        nudge(byKey.get(focused)!, steps);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Mouse wheel over a slider changes its value instead of scrolling the page.
  // Registered natively because React's wheel listener is passive (cannot preventDefault).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let acc = 0;
    let accKey = "";
    const onWheel = (e: WheelEvent) => {
      const block = (e.target as Element).closest<HTMLElement>("[data-key]");
      const key = block?.dataset.key;
      if (!key) return;
      e.preventDefault();
      if (key !== accKey) {
        acc = 0;
        accKey = key;
      }
      setFocused(key);
      // deltaMode 1 = lines, 2 = pages
      const px = e.deltaY * (e.deltaMode === 1 ? WHEEL_PX_PER_STEP : e.deltaMode === 2 ? 400 : 1);
      acc += px;
      const steps = Math.trunc(acc / WHEEL_PX_PER_STEP);
      if (steps) {
        acc -= steps * WHEEL_PX_PER_STEP;
        // Wheel down (positive deltaY) increases the value.
        latest.current.nudge(byKey.get(key)!, steps);
      }
    };
    grid.addEventListener("wheel", onWheel, { passive: false });
    return () => grid.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={styles.grid} ref={gridRef}>
      {COLUMNS.map((column, i) => (
        <section className={styles.column} key={i}>
          {column.map((p) => (
            <Slider
              key={p.key}
              dataKey={p.key}
              label={t(p.label)}
              value={values[p.key] ?? null}
              min={p.min}
              max={p.max}
              track={p.track}
              format={p.format}
              focused={focused === p.key}
              onMouseEnter={() => setFocused(p.key)}
              onChange={(v) => setValue(p, v)}
              onReset={p.defaultValue === undefined ? undefined : () => setValue(p, p.defaultValue!)}
              onDragStart={() => setDragging(p, true)}
              onDragEnd={() => setDragging(p, false)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
