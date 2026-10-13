"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./SegmentedControl.module.css";

export interface Segment<T extends string> {
  id: T;
  label: ReactNode;
}

/**
 * iOS segmented control: equal segments on a gray track, with a raised thumb
 * that slides to the chosen one. A radio group to assistive tech; arrow keys
 * move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  className,
}: {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, segments.findIndex((s) => s.id === value));

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + segments.length) % segments.length;
    onChange(segments[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(styles.control, className)}
      style={{ "--n": segments.length, "--i": index } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {segments.map((s, i) => (
        <button
          key={s.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === index ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
